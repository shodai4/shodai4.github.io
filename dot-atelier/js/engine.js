(function (global) {
  'use strict';

  // Bayer 4x4 ディザ行列 (-0.5 ~ +0.5 正規化)
  const BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ].map(row => row.map(v => (v + 0.5) / 16 - 0.5));

  // --- 色空間変換 (sRGB <-> Oklab) ---
  function srgbToLinear(c) {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }

  function linearToSrgb(v) {
    const clamped = Math.max(0, Math.min(1, v));
    const s = clamped <= 0.0031308 ? 12.92 * clamped : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.round(s * 255);
  }

  function rgbToOklab(r, g, b) {
    const lr = srgbToLinear(r);
    const lg = srgbToLinear(g);
    const lb = srgbToLinear(b);

    const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
    const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
    const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    return [
      0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
      1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
      0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_
    ];
  }

  function oklabToRgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    const s_ = L - 0.0894841775 * a - 1.2914855480 * b;

    const l = l_ * l_ * l_;
    const m = m_ * m_ * m_;
    const s = s_ * s_ * s_;

    const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

    return [linearToSrgb(lr), linearToSrgb(lg), linearToSrgb(lb)];
  }

  function colorDistanceSq(c1, c2) {
    const dr = c1[0] - c2[0];
    const dg = c1[1] - c2[1];
    const db = c1[2] - c2[2];
    return dr * dr + dg * dg + db * db;
  }

  function oklabDistSq(o1, o2) {
    const dL = o1[0] - o2[0];
    const da = o1[1] - o2[1];
    const db = o1[2] - o2[2];
    return dL * dL + da * da + db * db;
  }

  // 外周からのフラッドフィル背景透過
  function removeOuterBackground(rgba, width, height, tolerance) {
    const out = new Uint8ClampedArray(rgba);
    const tolSq = tolerance * tolerance * 3;
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    // 四隅から背景代表色をサンプリング
    const corners = [
      0,
      (width - 1) * 4,
      ((height - 1) * width) * 4,
      ((height - 1) * width + (width - 1)) * 4
    ];
    const bgSamples = corners
      .filter(idx => out[idx + 3] > 128)
      .map(idx => [out[idx], out[idx + 1], out[idx + 2]]);

    if (bgSamples.length === 0) return out;

    function isBgColor(idx) {
      if (out[idx + 3] <= 128) return true;
      const rgb = [out[idx], out[idx + 1], out[idx + 2]];
      for (let i = 0; i < bgSamples.length; i++) {
        if (colorDistanceSq(rgb, bgSamples[i]) <= tolSq) return true;
      }
      return false;
    }

    for (let x = 0; x < width; x++) {
      const top = x;
      const bot = (height - 1) * width + x;
      if (!visited[top] && isBgColor(top * 4)) { visited[top] = 1; queue[tail++] = top; }
      if (!visited[bot] && isBgColor(bot * 4)) { visited[bot] = 1; queue[tail++] = bot; }
    }
    for (let y = 0; y < height; y++) {
      const left = y * width;
      const right = y * width + (width - 1);
      if (!visited[left] && isBgColor(left * 4)) { visited[left] = 1; queue[tail++] = left; }
      if (!visited[right] && isBgColor(right * 4)) { visited[right] = 1; queue[tail++] = right; }
    }

    while (head < tail) {
      const p = queue[head++];
      out[p * 4 + 3] = 0;
      const x = p % width;
      const y = (p / width) | 0;
      const neighbors = [
        x > 0 ? p - 1 : -1,
        x + 1 < width ? p + 1 : -1,
        y > 0 ? p - width : -1,
        y + 1 < height ? p + width : -1
      ];
      for (let i = 0; i < 4; i++) {
        const np = neighbors[i];
        if (np >= 0 && !visited[np] && isBgColor(np * 4)) {
          visited[np] = 1;
          queue[tail++] = np;
        }
      }
    }
    return out;
  }

  // 指定色クリック透過
  function removeColorBySample(rgba, width, height, targetRgb, tolerance) {
    const out = new Uint8ClampedArray(rgba);
    const tolSq = tolerance * tolerance * 3;
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (out[idx + 3] === 0) continue;
      if (colorDistanceSq([out[idx], out[idx + 1], out[idx + 2]], targetRgb) <= tolSq) {
        out[idx + 3] = 0;
      }
    }
    return out;
  }

  // Step 1: エッジ保存平滑化（簡易バイラテラルフィルタ）
  function edgePreservingSmooth(rgba, width, height) {
    const out = new Uint8ClampedArray(rgba.length);
    const sigmaColorSq = 38 * 38 * 3;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const cIdx = (y * width + x) * 4;
        if (rgba[cIdx + 3] < 128) {
          out[cIdx + 3] = 0;
          continue;
        }
        const cr = rgba[cIdx], cg = rgba[cIdx + 1], cb = rgba[cIdx + 2];
        let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if (nx < 0 || nx >= width) continue;
            const nIdx = (ny * width + nx) * 4;
            if (rgba[nIdx + 3] < 128) continue;
            const nr = rgba[nIdx], ng = rgba[nIdx + 1], nb = rgba[nIdx + 2];
            const distSq = (cr - nr) ** 2 + (cg - ng) ** 2 + (cb - nb) ** 2;
            const w = Math.exp(-distSq / sigmaColorSq);
            sumR += nr * w;
            sumG += ng * w;
            sumB += nb * w;
            sumW += w;
          }
        }
        out[cIdx] = Math.round(sumR / sumW);
        out[cIdx + 1] = Math.round(sumG / sumW);
        out[cIdx + 2] = Math.round(sumB / sumW);
        out[cIdx + 3] = 255;
      }
    }
    return out;
  }

  // Step 2: エッジ優先・代表色ダウンサンプリング（目や輪郭線を潰さない）
  function edgePriorityDownscale(rgba, srcW, srcH, dstW, dstH) {
    const out = new Uint8ClampedArray(dstW * dstH * 4);

    // 輝度マップとエッジ強度を事前計算
    const lum = new Float32Array(srcW * srcH);
    for (let i = 0; i < srcW * srcH; i++) {
      const idx = i * 4;
      lum[i] = 0.2126 * rgba[idx] + 0.7152 * rgba[idx + 1] + 0.0722 * rgba[idx + 2];
    }

    const edge = new Float32Array(srcW * srcH);
    for (let y = 1; y < srcH - 1; y++) {
      for (let x = 1; x < srcW - 1; x++) {
        const p = y * srcW + x;
        const gx = Math.abs(lum[p + 1] - lum[p - 1]);
        const gy = Math.abs(lum[p + srcW] - lum[p - srcW]);
        edge[p] = gx + gy;
      }
    }

    for (let dy = 0; dy < dstH; dy++) {
      const y0 = Math.floor((dy * srcH) / dstH);
      const y1 = Math.max(y0 + 1, Math.floor(((dy + 1) * srcH) / dstH));
      for (let dx = 0; dx < dstW; dx++) {
        const x0 = Math.floor((dx * srcW) / dstW);
        const x1 = Math.max(x0 + 1, Math.floor(((dx + 1) * srcW) / dstW));

        let opaqueCount = 0;
        let totalCount = 0;
        let bestScore = -1;
        let bestIdx = -1;
        let sumR = 0, sumG = 0, sumB = 0;
        let sumLum = 0;
        let minLum = Infinity;
        let darkIdx = -1;

        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            const p = sy * srcW + sx;
            const idx = p * 4;
            totalCount++;
            if (rgba[idx + 3] >= 128) {
              opaqueCount++;
              sumR += rgba[idx];
              sumG += rgba[idx + 1];
              sumB += rgba[idx + 2];
              sumLum += lum[p];
              if (lum[p] < minLum) {
                minLum = lum[p];
                darkIdx = idx;
              }
              // 輪郭・暗い線（瞳・主線）を優先保存
              const darkBoost = (255 - lum[p]) * 0.25;
              const score = edge[p] * 1.4 + darkBoost;
              if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
              }
            }
          }
        }

        const outIdx = (dy * dstW + dx) * 4;
        if (opaqueCount * 2 < totalCount || opaqueCount === 0) {
          out[outIdx + 3] = 0;
          continue;
        }

        // エッジが強く立っているセルはエッジ代表ピクセル、細い暗線を含むセルは
        // その線を残して、平坦部だけ平均色にする
        const cellMeanLum = sumLum / opaqueCount;
        if (darkIdx >= 0 && cellMeanLum - minLum > 42) {
          // セルの中に細い暗線（主線・瞳・輪郭）がある場合はそれを残す
          out[outIdx] = rgba[darkIdx];
          out[outIdx + 1] = rgba[darkIdx + 1];
          out[outIdx + 2] = rgba[darkIdx + 2];
        } else if (bestScore > 75 && bestIdx >= 0) {
          out[outIdx] = rgba[bestIdx];
          out[outIdx + 1] = rgba[bestIdx + 1];
          out[outIdx + 2] = rgba[bestIdx + 2];
        } else {
          out[outIdx] = Math.round(sumR / opaqueCount);
          out[outIdx + 1] = Math.round(sumG / opaqueCount);
          out[outIdx + 2] = Math.round(sumB / opaqueCount);
        }
        out[outIdx + 3] = 255;
      }
    }
    return out;
  }

  // Step 3: Oklab K-Means++ 減色 ＋ ヒューシフト
  function quantizeOklab(rgba, width, height, options) {
    const {
      maxColors = 16,
      fixedPalette = null,
      hueShift = true,
      dither = 'none'
    } = options;

    let paletteRgb = fixedPalette ? fixedPalette.map(c => [...c]) : null;

    if (!paletteRgb) {
      const samples = [];
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        if (rgba[idx + 3] >= 128) {
          samples.push(rgbToOklab(rgba[idx], rgba[idx + 1], rgba[idx + 2]));
        }
      }

      if (samples.length === 0) {
        return { rgba: new Uint8ClampedArray(rgba), palette: [] };
      }

      const k = Math.min(maxColors, samples.length);
      // 決定論的シードでK-Means++初期化
      const centroids = [samples[0].slice()];
      while (centroids.length < k) {
        let maxD = -1;
        let farSample = samples[0];
        for (let i = 0; i < samples.length; i++) {
          let minD = Infinity;
          for (let j = 0; j < centroids.length; j++) {
            const d = oklabDistSq(samples[i], centroids[j]);
            if (d < minD) minD = d;
          }
          if (minD > maxD) {
            maxD = minD;
            farSample = samples[i];
          }
        }
        centroids.push(farSample.slice());
      }

      // 8イテレーション収束
      for (let iter = 0; iter < 8; iter++) {
        const sums = Array.from({ length: k }, () => [0, 0, 0, 0]);
        for (let i = 0; i < samples.length; i++) {
          let best = 0;
          let bestD = Infinity;
          for (let j = 0; j < k; j++) {
            const d = oklabDistSq(samples[i], centroids[j]);
            if (d < bestD) { bestD = d; best = j; }
          }
          sums[best][0] += samples[i][0];
          sums[best][1] += samples[i][1];
          sums[best][2] += samples[i][2];
          sums[best][3] += 1;
        }
        for (let j = 0; j < k; j++) {
          if (sums[j][3] > 0) {
            centroids[j][0] = sums[j][0] / sums[j][3];
            centroids[j][1] = sums[j][1] / sums[j][3];
            centroids[j][2] = sums[j][2] / sums[j][3];
          }
        }
      }

      // ヒューシフト：影(L<0.45)を青紫寄り(b減)、光(L>0.72)を黄寄り(b増)へ微調整
      paletteRgb = centroids.map(([L, a, b]) => {
        let sA = a;
        let sB = b;
        if (hueShift) {
          if (L < 0.45) {
            const t = (0.45 - L) / 0.45;
            sB -= 0.025 * t;
            sA += 0.01 * t;
          } else if (L > 0.72) {
            const t = (L - 0.72) / 0.28;
            sB += 0.028 * t;
          }
        }
        return oklabToRgb(L, sA, sB);
      });
    }

    const paletteLab = paletteRgb.map(([r, g, b]) => rgbToOklab(r, g, b));
    const out = new Uint8ClampedArray(rgba.length);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (rgba[idx + 3] < 128) {
          out[idx + 3] = 0;
          continue;
        }
        const lab = rgbToOklab(rgba[idx], rgba[idx + 1], rgba[idx + 2]);
        if (dither === 'bayer4') {
          lab[0] += BAYER_4X4[y & 3][x & 3] * 0.09;
        }
        let best = 0;
        let bestD = Infinity;
        for (let j = 0; j < paletteLab.length; j++) {
          const d = oklabDistSq(lab, paletteLab[j]);
          if (d < bestD) { bestD = d; best = j; }
        }
        out[idx] = paletteRgb[best][0];
        out[idx + 1] = paletteRgb[best][1];
        out[idx + 2] = paletteRgb[best][2];
        out[idx + 3] = 255;
      }
    }

    return { rgba: out, palette: paletteRgb };
  }

  // Step 4: 8近傍から浮いた孤立1粒ノイズ除去
  function removeIsolatedPixels(rgba, width, height) {
    const out = new Uint8ClampedArray(rgba);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const isOpaque = rgba[idx + 3] >= 128;
        let sameCount = 0;
        const neighborColors = [];

        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx;
            if ((dx === 0 && dy === 0) || nx < 0 || nx >= width) continue;
            const nIdx = (ny * width + nx) * 4;
            const nOpaque = rgba[nIdx + 3] >= 128;
            if (isOpaque && nOpaque) {
              neighborColors.push([rgba[nIdx], rgba[nIdx + 1], rgba[nIdx + 2]]);
              if (
                rgba[nIdx] === rgba[idx] &&
                rgba[nIdx + 1] === rgba[idx + 1] &&
                rgba[nIdx + 2] === rgba[idx + 2]
              ) {
                sameCount++;
              }
            }
          }
        }

        if (isOpaque && neighborColors.length === 0) {
          // 周囲が完全に透明な1粒ゴミを削除
          out[idx + 3] = 0;
        } else if (isOpaque && sameCount === 0 && neighborColors.length >= 6) {
          // 周囲と完全に色が浮いている1粒ノイズを最多近傍色へ置換
          out[idx] = neighborColors[0][0];
          out[idx + 1] = neighborColors[0][1];
          out[idx + 2] = neighborColors[0][2];
        }
      }
    }
    return out;
  }

  // Step 5a: L字の角（ダブルピクセル）間引き
  function thinJaggyCorners(rgba, width, height) {
    const out = new Uint8ClampedArray(rgba);
    const isOpaque = (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return false;
      return rgba[(y * width + x) * 4 + 3] >= 128;
    };

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        if (!isOpaque(x, y)) continue;
        const u = isOpaque(x, y - 1);
        const d = isOpaque(x, y + 1);
        const l = isOpaque(x - 1, y);
        const r = isOpaque(x + 1, y);
        const ul = isOpaque(x - 1, y - 1);
        const ur = isOpaque(x + 1, y - 1);
        const dl = isOpaque(x - 1, y + 1);
        const dr = isOpaque(x + 1, y + 1);

        // 外周の階段状L字ダブルピクセルを検出して内側へ整理
        if (u && r && !d && !l && !ur && !dl) out[(y * width + x) * 4 + 3] = 0;
        else if (u && l && !d && !r && !ul && !dr) out[(y * width + x) * 4 + 3] = 0;
        else if (d && r && !u && !l && !dr && !ul) out[(y * width + x) * 4 + 3] = 0;
        else if (d && l && !u && !r && !dl && !ur) out[(y * width + x) * 4 + 3] = 0;
      }
    }
    return out;
  }

  // Step 5b: 1px 輪郭線付与（黒 / 色トレス）
  function applyOutline(rgba, width, height, mode) {
    if (mode === 'none') return new Uint8ClampedArray(rgba);
    const out = new Uint8ClampedArray(rgba);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        if (rgba[idx + 3] >= 128) continue;

        let adjIdx = -1;
        for (let d = 0; d < 4; d++) {
          const nx = x + dirs[d][0];
          const ny = y + dirs[d][1];
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = (ny * width + nx) * 4;
          if (rgba[nIdx + 3] >= 128) {
            adjIdx = nIdx;
            break;
          }
        }

        if (adjIdx >= 0) {
          // すでに隣が暗い線なら二重輪郭にしない（1pxを保つ）
          const adjLum =
            0.2126 * rgba[adjIdx] + 0.7152 * rgba[adjIdx + 1] + 0.0722 * rgba[adjIdx + 2];
          if (adjLum < 60) continue;

          if (mode === 'black') {
            out[idx] = 20;
            out[idx + 1] = 20;
            out[idx + 2] = 22;
            out[idx + 3] = 255;
          } else if (mode === 'colortrace') {
            const [L, a, b] = rgbToOklab(rgba[adjIdx], rgba[adjIdx + 1], rgba[adjIdx + 2]);
            const [or, og, ob] = oklabToRgb(Math.max(0.14, L * 0.45), a * 0.9, b - 0.02);
            out[idx] = or;
            out[idx + 1] = og;
            out[idx + 2] = ob;
            out[idx + 3] = 255;
          }
        }
      }
    }
    return out;
  }

  // シームレスタイル化（左右・上下の端を同じ色へ寄せ、タイル境界の継ぎ目を消す）
  function makeSeamlessTile(rgba, width, height) {
    const out = new Uint8ClampedArray(rgba);
    const bandX = Math.max(1, Math.floor(width * 0.18));
    const bandY = Math.max(1, Math.floor(height * 0.18));

    // 左右端：両端の平均色を基準に、端から内側へなじませる
    for (let y = 0; y < height; y++) {
      const leftBase = (y * width) * 4;
      const rightBase = (y * width + (width - 1)) * 4;
      for (let c = 0; c < 3; c++) {
        const lv = out[leftBase + c];
        const rv = out[rightBase + c];
        const avg = (lv + rv) / 2;
        for (let x = 0; x < bandX; x++) {
          const t = x / bandX;
          const li = (y * width + x) * 4;
          const ri = (y * width + (width - 1 - x)) * 4;
          out[li + c] = Math.round(avg + (lv - avg) * t);
          out[ri + c] = Math.round(avg + (rv - avg) * t);
        }
      }
    }

    // 上下端も同様（x=0 / y=0 の列・行は左右の結果をそのまま使う）
    for (let x = 0; x < width; x++) {
      const topBase = x * 4;
      const bottomBase = ((height - 1) * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const tv = out[topBase + c];
        const bv = out[bottomBase + c];
        const avg = (tv + bv) / 2;
        for (let y = 0; y < bandY; y++) {
          const t = y / bandY;
          const ti = (y * width + x) * 4;
          const bi = ((height - 1 - y) * width + x) * 4;
          out[ti + c] = Math.round(avg + (tv - avg) * t);
          out[bi + c] = Math.round(avg + (bv - avg) * t);
        }
      }
    }
    return out;
  }

  // 色違い・差分生成（2P色相シフト / ダメージ白フラッシュ / 半透明黒影）
  function applyVariant(rgba, width, height, variant, hueAngleDeg = 135) {
    const out = new Uint8ClampedArray(rgba);
    if (variant === 'normal') return out;

    const rad = (hueAngleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      if (out[idx + 3] === 0) continue;

      if (variant === 'flash') {
        out[idx] = 255;
        out[idx + 1] = 255;
        out[idx + 2] = 255;
      } else if (variant === 'shadow') {
        out[idx] = 16;
        out[idx + 1] = 16;
        out[idx + 2] = 20;
        out[idx + 3] = 140;
      } else if (variant === 'p2') {
        // 暗い輪郭線(L < 0.22)は色相回転せず保護
        const [L, a, b] = rgbToOklab(out[idx], out[idx + 1], out[idx + 2]);
        if (L >= 0.22) {
          const na = a * cos - b * sin;
          const nb = a * sin + b * cos;
          const [nr, ng, nbRgb] = oklabToRgb(L, na, nb);
          out[idx] = nr;
          out[idx + 1] = ng;
          out[idx + 2] = nbRgb;
        }
      }
    }
    return out;
  }

  // スプライトシート横結合（N枚 -> W*N × H）
  function mergeSpriteSheet(frames) {
    if (!frames || frames.length === 0) return null;
    const w = frames[0].width;
    const h = frames[0].height;
    const totalW = w * frames.length;
    const out = new Uint8ClampedArray(totalW * h * 4);

    frames.forEach((frame, fIdx) => {
      const offsetX = fIdx * w;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const srcIdx = (y * w + x) * 4;
          const dstIdx = (y * totalW + (offsetX + x)) * 4;
          out[dstIdx] = frame.rgba[srcIdx];
          out[dstIdx + 1] = frame.rgba[srcIdx + 1];
          out[dstIdx + 2] = frame.rgba[srcIdx + 2];
          out[dstIdx + 3] = frame.rgba[srcIdx + 3];
        }
      }
    });

    return { rgba: out, width: totalW, height: h };
  }

  // 統合5段階パイプライン実行
  function convertToPixelArt(srcRgba, srcW, srcH, config) {
    const {
      targetSize = 32,
      maxColors = 16,
      fixedPalette = null,
      bgMode = 'auto',
      bgTolerance = 22,
      smooth = true,
      hueShift = true,
      despeckle = true,
      dejaggy = true,
      outline = 'black',
      dither = 'none',
      seamless = false,
      variant = 'normal',
      hueAngle = 135
    } = config;

    // アスペクト比を維持して targetSize 内に収める
    const aspect = srcW / srcH;
    const dstW = aspect >= 1 ? targetSize : Math.max(8, Math.round(targetSize * aspect));
    const dstH = aspect >= 1 ? Math.max(8, Math.round(targetSize / aspect)) : targetSize;

    let work = new Uint8ClampedArray(srcRgba);
    if (bgMode === 'auto') {
      work = removeOuterBackground(work, srcW, srcH, bgTolerance);
    }
    if (smooth) {
      work = edgePreservingSmooth(work, srcW, srcH);
    }

    let small = edgePriorityDownscale(work, srcW, srcH, dstW, dstH);
    if (seamless) {
      small = makeSeamlessTile(small, dstW, dstH);
    }

    const quantized = quantizeOklab(small, dstW, dstH, {
      maxColors,
      fixedPalette,
      hueShift,
      dither
    });
    small = quantized.rgba;

    if (despeckle) {
      small = removeIsolatedPixels(small, dstW, dstH);
    }
    if (dejaggy) {
      small = thinJaggyCorners(small, dstW, dstH);
    }
    if (outline !== 'none') {
      small = applyOutline(small, dstW, dstH, outline);
    }
    if (variant !== 'normal') {
      small = applyVariant(small, dstW, dstH, variant, hueAngle);
    }

    return {
      rgba: small,
      width: dstW,
      height: dstH,
      palette: quantized.palette
    };
  }

  const exported = {
    rgbToOklab,
    oklabToRgb,
    removeOuterBackground,
    removeColorBySample,
    edgePreservingSmooth,
    edgePriorityDownscale,
    quantizeOklab,
    removeIsolatedPixels,
    thinJaggyCorners,
    applyOutline,
    makeSeamlessTile,
    applyVariant,
    mergeSpriteSheet,
    convertToPixelArt
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    global.DotEngine = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
