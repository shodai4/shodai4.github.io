const test = require('node:test');
const assert = require('node:assert/strict');
const Engine = require('../js/engine.js');
const Palettes = require('../js/palettes.js');

test('rgbToOklab and oklabToRgb roundtrip accuracy', () => {
  const [L, a, b] = Engine.rgbToOklab(220, 90, 60);
  const [r, g, bl] = Engine.oklabToRgb(L, a, b);
  assert.ok(Math.abs(r - 220) <= 2);
  assert.ok(Math.abs(g - 90) <= 2);
  assert.ok(Math.abs(bl - 60) <= 2);
});

test('removeOuterBackground strips outer background while keeping inner subject', () => {
  const w = 6, h = 6;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = 255; rgba[i * 4 + 1] = 255; rgba[i * 4 + 2] = 255; rgba[i * 4 + 3] = 255;
  }
  for (let y = 2; y <= 3; y++) {
    for (let x = 2; x <= 3; x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 200; rgba[idx + 1] = 40; rgba[idx + 2] = 40;
    }
  }
  const res = Engine.removeOuterBackground(rgba, w, h, 15);
  assert.equal(res[0 + 3], 0);
  assert.equal(res[(2 * w + 2) * 4 + 3], 255);
});

test('convertToPixelArt produces exact 1x dimensions and merges spritesheet', () => {
  const w = 64, h = 64;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 16; y < 48; y++) {
    for (let x = 16; x < 48; x++) {
      const idx = (y * w + x) * 4;
      rgba[idx] = 74; rgba[idx + 1] = 106; rgba[idx + 2] = 122; rgba[idx + 3] = 255;
    }
  }
  const f1 = Engine.convertToPixelArt(rgba, w, h, {
    targetSize: 32,
    fixedPalette: Palettes.PRESET_PALETTES.pico8,
    outline: 'black'
  });
  assert.equal(f1.width, 32);
  assert.equal(f1.height, 32);

  const sheet = Engine.mergeSpriteSheet([f1, f1, f1, f1]);
  assert.equal(sheet.width, 128);
  assert.equal(sheet.height, 32);
});
// --- 5段階パイプライン / 全8機能の検証 ---

function solid(w, h, rgb, alpha = 255) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = rgb[0];
    rgba[i * 4 + 1] = rgb[1];
    rgba[i * 4 + 2] = rgb[2];
    rgba[i * 4 + 3] = alpha;
  }
  return rgba;
}

function put(rgba, w, x, y, rgb, alpha = 255) {
  const i = (y * w + x) * 4;
  rgba[i] = rgb[0];
  rgba[i + 1] = rgb[1];
  rgba[i + 2] = rgb[2];
  rgba[i + 3] = alpha;
}

function get(rgba, w, x, y) {
  const i = (y * w + x) * 4;
  return [rgba[i], rgba[i + 1], rgba[i + 2], rgba[i + 3]];
}

test('step1: edgePreservingSmooth keeps the boundary between two flat colors', () => {
  const w = 8, h = 8;
  const src = solid(w, h, [20, 20, 20]);
  for (let y = 0; y < h; y++) for (let x = 4; x < w; x++) put(src, w, x, y, [240, 240, 240]);
  const out = Engine.edgePreservingSmooth(src, w, h);
  assert.ok(get(out, w, 3, 4)[0] < 80, 'dark side stays dark');
  assert.ok(get(out, w, 4, 4)[0] > 180, 'light side stays light');
});

test('step2: edgePriorityDownscale keeps a 1px dark line', () => {
  const w = 32, h = 32;
  const src = solid(w, h, [250, 250, 250]);
  for (let y = 0; y < h; y++) put(src, w, 16, y, [10, 10, 10]);
  const out = Engine.edgePriorityDownscale(src, w, h, 8, 8);
  let darkest = 255;
  for (let i = 0; i < 8 * 8; i++) darkest = Math.min(darkest, out[i * 4]);
  assert.ok(darkest < 90, `line survives downscale (darkest=${darkest})`);
});

test('step3: quantizeOklab caps colors and locks to a fixed palette', () => {
  const w = 16, h = 16;
  const src = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) put(src, w, x, y, [x * 16, y * 16, (x + y) * 8]);
  }
  const res = Engine.quantizeOklab(src, w, h, { maxColors: 4 });
  const uniq = new Set();
  for (let i = 0; i < w * h; i++) uniq.add(res.rgba.slice(i * 4, i * 4 + 3).join(','));
  assert.ok(uniq.size <= 4, `maxColors respected (${uniq.size})`);

  const fixed = Palettes.PRESET_PALETTES.pico8;
  const locked = Engine.quantizeOklab(src, w, h, { maxColors: 16, fixedPalette: fixed });
  const allowed = new Set(fixed.map(c => c.join(',')));
  for (let i = 0; i < w * h; i++) {
    assert.ok(allowed.has(locked.rgba.slice(i * 4, i * 4 + 3).join(',')), 'pixel comes from the fixed palette');
  }
});

test('step4: removeIsolatedPixels deletes a lone pixel and keeps a 2x2 blob', () => {
  const w = 8, h = 8;
  const src = solid(w, h, [0, 0, 0], 0);
  put(src, w, 1, 1, [200, 30, 30]);
  put(src, w, 5, 5, [30, 200, 30]);
  put(src, w, 6, 5, [30, 200, 30]);
  put(src, w, 5, 6, [30, 200, 30]);
  put(src, w, 6, 6, [30, 200, 30]);
  const out = Engine.removeIsolatedPixels(src, w, h);
  assert.equal(get(out, w, 1, 1)[3], 0);
  assert.equal(get(out, w, 5, 5)[3], 255);
});

test('step5a: thinJaggyCorners removes an L-shaped double pixel', () => {
  const w = 6, h = 6;
  const src = solid(w, h, [0, 0, 0], 0);
  put(src, w, 2, 1, [255, 0, 0]);
  put(src, w, 2, 2, [255, 0, 0]);
  put(src, w, 3, 2, [255, 0, 0]);
  const out = Engine.thinJaggyCorners(src, w, h);
  assert.equal(get(out, w, 2, 2)[3], 0, 'corner pixel thinned');
  assert.equal(get(out, w, 2, 1)[3], 255);
});

test('step5b: applyOutline adds a 1px black ring and can trace in color', () => {
  const w = 6, h = 6;
  const src = solid(w, h, [255, 255, 255], 0);
  for (let y = 2; y < 4; y++) for (let x = 2; x < 4; x++) put(src, w, x, y, [74, 106, 122]);
  const black = Engine.applyOutline(src, w, h, 'black');
  assert.equal(get(black, w, 2, 1)[3], 255);
  assert.deepEqual(get(black, w, 2, 1).slice(0, 3), [20, 20, 22]);
  assert.equal(get(black, w, 0, 0)[3], 0, 'far pixel untouched');

  const traced = Engine.applyOutline(src, w, h, 'colortrace');
  const [, , , a] = get(traced, w, 2, 1);
  assert.equal(a, 255);
  assert.ok(get(traced, w, 2, 1)[2] < 122, 'color trace is a darker version');
});

test('makeSeamlessTile makes opposite edges identical', () => {
  const w = 16, h = 12;
  const src = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      put(src, w, x, y, [(x * 37 + y * 11) % 256, (x * 13 + y * 53) % 256, (x * 7 + y * 91) % 256]);
    }
  }
  const out = Engine.makeSeamlessTile(src, w, h);
  for (let y = 0; y < h; y++) {
    assert.deepEqual(get(out, w, 0, y).slice(0, 3), get(out, w, w - 1, y).slice(0, 3), `row ${y} edges match`);
  }
  for (let x = 0; x < w; x++) {
    assert.deepEqual(get(out, w, x, 0).slice(0, 3), get(out, w, x, h - 1).slice(0, 3), `col ${x} edges match`);
  }
});

test('applyVariant: p2 rotates hue but protects dark outline, flash/shadow variants', () => {
  const w = 4, h = 1;
  const src = solid(w, h, [0, 0, 0], 0);
  put(src, w, 0, 0, [10, 10, 12]);   // 暗い輪郭
  put(src, w, 1, 0, [200, 40, 40]);  // 赤
  const p2 = Engine.applyVariant(src, w, h, 'p2', 135);
  assert.deepEqual(get(p2, w, 0, 0).slice(0, 3), [10, 10, 12]);
  assert.notDeepEqual(get(p2, w, 1, 0).slice(0, 3), [200, 40, 40]);

  const flash = Engine.applyVariant(src, w, h, 'flash');
  assert.deepEqual(get(flash, w, 1, 0).slice(0, 3), [255, 255, 255]);

  const shadow = Engine.applyVariant(src, w, h, 'shadow');
  assert.equal(get(shadow, w, 1, 0)[3], 140);
});

test('convertToPixelArt: full pipeline, transparent bg, palette-locked second frame', () => {
  const w = 40, h = 40;
  const src = solid(w, h, [255, 255, 255]);
  for (let y = 10; y < 30; y++) for (let x = 12; x < 28; x++) put(src, w, x, y, [180, 60, 60]);
  const first = Engine.convertToPixelArt(src, w, h, {
    targetSize: 16,
    maxColors: 8,
    fixedPalette: Palettes.PRESET_PALETTES.gb,
    outline: 'black',
    bgTolerance: 22
  });
  assert.equal(first.width, 16);
  assert.equal(first.height, 16);
  assert.equal(get(first.rgba, 16, 0, 0)[3], 0, 'outer background removed');

  const second = Engine.convertToPixelArt(src, w, h, {
    targetSize: 16,
    maxColors: 8,
    fixedPalette: first.palette,
    outline: 'black',
    bgTolerance: 22
  });
  const a = new Set();
  const b = new Set();
  for (let i = 0; i < first.rgba.length; i += 4) {
    if (first.rgba[i + 3] > 0) a.add(first.rgba.slice(i, i + 3).join(','));
    if (second.rgba[i + 3] > 0) b.add(second.rgba.slice(i, i + 3).join(','));
  }
  for (const color of b) assert.ok(a.has(color), 'palette lock keeps the first frame palette');
});

test('convertToPixelArt: dither switch changes the result and seamless edges match', () => {
  const w = 32, h = 32;
  const src = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round((x / (w - 1)) * 255);
      put(src, w, x, y, [v, v, v]);
    }
  }
  const noDither = Engine.convertToPixelArt(src, w, h, { targetSize: 16, maxColors: 4, dither: 'none', outline: 'none' });
  const bayer = Engine.convertToPixelArt(src, w, h, { targetSize: 16, maxColors: 4, dither: 'bayer4', outline: 'none' });
  assert.notDeepEqual(Array.from(noDither.rgba), Array.from(bayer.rgba), 'dither changes output');

  const tile = Engine.convertToPixelArt(src, w, h, {
    targetSize: 16, maxColors: 4, dither: 'none', outline: 'none', seamless: true
  });
  for (let y = 0; y < tile.height; y++) {
    assert.deepEqual(get(tile.rgba, tile.width, 0, y).slice(0, 3), get(tile.rgba, tile.width, tile.width - 1, y).slice(0, 3));
  }
});

test('removeColorBySample only clears pixels of the sampled color', () => {
  const w = 4, h = 4;
  const src = solid(w, h, [255, 255, 255]);
  put(src, w, 1, 1, [0, 0, 255]);
  const out = Engine.removeColorBySample(src, w, h, [255, 255, 255], 10);
  assert.equal(get(out, w, 0, 0)[3], 0);
  assert.equal(get(out, w, 1, 1)[3], 255);
});
