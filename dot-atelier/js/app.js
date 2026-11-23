(function () {
  'use strict';

  const { PRESET_PALETTES, PRESET_CONFIGS } = window.DotPalettes;
  const Engine = window.DotEngine;

  const state = {
    items: [], // { name, srcCanvas, srcRgba, srcW, srcH, result }
    activeIndex: 0,
    lockedPalette: null,
    viewMode: 'result', // result | compare | tile
    dotTool: 'pen', // pen | eraser | eyedropper
    pickBgMode: false,
    undoStack: []
  };

  const els = {
    fileInput: document.getElementById('file-input'),
    dropzone: document.getElementById('empty-dropzone'),
    viewport: document.getElementById('canvas-viewport'),
    canvas: document.getElementById('preview-canvas'),
    sizeReadout: document.getElementById('size-readout'),
    paletteSwatches: document.getElementById('palette-swatches'),
    batchStrip: document.getElementById('batch-strip'),
    batchThumbs: document.getElementById('batch-thumbs'),
    btnExportPng: document.getElementById('btn-export-png'),
    btnExportSheet: document.getElementById('btn-export-sheet'),
    btnExportAll: document.getElementById('btn-export-all'),
    btnPickBg: document.getElementById('btn-pick-bg'),
    btnUndoDot: document.getElementById('btn-undo-dot'),
    penColor: document.getElementById('pen-color'),
    optSize: document.getElementById('opt-size'),
    optColors: document.getElementById('opt-colors'),
    optDither: document.getElementById('opt-dither'),
    optOutline: document.getElementById('opt-outline'),
    optBgMode: document.getElementById('opt-bg-mode'),
    optBgTol: document.getElementById('opt-bg-tol'),
    optSmooth: document.getElementById('opt-smooth'),
    optHueShift: document.getElementById('opt-hueshift'),
    optDespeckle: document.getElementById('opt-despeckle'),
    optDejaggy: document.getElementById('opt-dejaggy'),
    optVariant: document.getElementById('opt-variant'),
    optHueAngle: document.getElementById('opt-hue-angle'),
    optSeamless: document.getElementById('opt-seamless'),
    optLockPalette: document.getElementById('opt-lock-palette')
  };

  let activePresetKey = 'custom';

  function getConfig(overridePalette = null) {
    const presetPalKey = PRESET_CONFIGS[activePresetKey]?.paletteKey;
    const presetPal = presetPalKey ? PRESET_PALETTES[presetPalKey] : null;
    return {
      targetSize: Number(els.optSize.value),
      maxColors: Number(els.optColors.value),
      fixedPalette: overridePalette || presetPal,
      dither: els.optDither.value,
      outline: els.optOutline.value,
      bgMode: els.optBgMode.value,
      bgTolerance: Number(els.optBgTol.value),
      smooth: els.optSmooth.checked,
      hueShift: els.optHueShift.checked,
      despeckle: els.optDespeckle.checked,
      dejaggy: els.optDejaggy.checked,
      variant: els.optVariant.value,
      hueAngle: Number(els.optHueAngle.value),
      seamless: els.optSeamless.checked
    };
  }

  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        // 処理高速化のため長辺512px以内に正規化
        const maxSide = 512;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(8, Math.round(img.width * scale));
        const h = Math.max(8, Math.round(img.height * scale));
        const off = document.createElement('canvas');
        off.width = w;
        off.height = h;
        const ctx = off.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve({
          name: file.name.replace(/\.[^.]+$/, ''),
          srcCanvas: off,
          srcRgba: imgData.data,
          srcW: w,
          srcH: h,
          result: null
        });
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;

    state.items = await Promise.all(files.map(loadImageFile));
    state.activeIndex = 0;
    state.lockedPalette = null;
    state.undoStack = [];
    els.btnUndoDot.disabled = true;
    reprocessAll();
  }

  function reprocessAll() {
    if (state.items.length === 0) return;
    state.lockedPalette = null;
    state.undoStack = [];
    if (els.btnUndoDot) els.btnUndoDot.disabled = true;

    state.items.forEach((item, idx) => {
      const pal = idx > 0 && els.optLockPalette.checked ? state.lockedPalette : null;
      const res = Engine.convertToPixelArt(item.srcRgba, item.srcW, item.srcH, getConfig(pal));
      item.result = res;
      if (idx === 0) {
        state.lockedPalette = res.palette;
      }
    });

    renderCurrent();
    renderBatchStrip();
  }

  function renderPaletteSwatches(palette) {
    els.paletteSwatches.innerHTML = '';
    palette.forEach(([r, g, b]) => {
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.style.backgroundColor = hex;
      btn.title = hex;
      btn.addEventListener('click', () => {
        els.penColor.value = hex;
      });
      els.paletteSwatches.appendChild(btn);
    });
  }

  function renderCurrent() {
    const item = state.items[state.activeIndex];
    if (!item || !item.result) return;

    els.dropzone.classList.add('hidden');
    els.canvas.classList.remove('hidden');
    els.btnExportPng.disabled = false;

    const { rgba, width, height, palette } = item.result;
    els.sizeReadout.textContent = `${width} × ${height} px (1×)`;
    renderPaletteSwatches(palette);

    const ctx = els.canvas.getContext('2d');
    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    const temp = document.createElement('canvas');
    temp.width = width;
    temp.height = height;
    temp.getContext('2d').putImageData(imgData, 0, 0);

    if (state.viewMode === 'tile') {
      els.canvas.width = width * 3;
      els.canvas.height = height * 3;
      ctx.imageSmoothingEnabled = false;
      for (let ty = 0; ty < 3; ty++) {
        for (let tx = 0; tx < 3; tx++) {
          ctx.drawImage(temp, tx * width, ty * height);
        }
      }
    } else if (state.viewMode === 'compare') {
      els.canvas.width = width * 2 + 2;
      els.canvas.height = height;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(item.srcCanvas, 0, 0, width, height);
      ctx.fillStyle = '#4a6a7a';
      ctx.fillRect(width, 0, 2, height);
      ctx.drawImage(temp, width + 2, 0);
    } else {
      els.canvas.width = width;
      els.canvas.height = height;
      ctx.putImageData(imgData, 0, 0);
    }

    fitCanvasToViewport();
  }

  // プレビューを枠いっぱいまで拡大（ドット絵は整数倍でぼかさない）
  function fitCanvasToViewport() {
    if (els.canvas.classList.contains('hidden')) return;
    const vp = els.viewport.getBoundingClientRect();
    const maxW = Math.max(80, vp.width - 24);
    const maxH = Math.max(80, vp.height - 24);
    let scale = Math.min(maxW / els.canvas.width, maxH / els.canvas.height);
    if (scale >= 2) scale = Math.floor(scale);
    els.canvas.style.width = Math.round(els.canvas.width * scale) + 'px';
    els.canvas.style.height = Math.round(els.canvas.height * scale) + 'px';
  }

  window.addEventListener('resize', fitCanvasToViewport);

  function renderBatchStrip() {
    if (state.items.length <= 1) {
      els.batchStrip.classList.add('hidden');
      return;
    }
    els.batchStrip.classList.remove('hidden');
    els.batchThumbs.innerHTML = '';

    state.items.forEach((item, idx) => {
      const c = document.createElement('canvas');
      c.width = item.result.width;
      c.height = item.result.height;
      c.className = 'batch-thumb' + (idx === state.activeIndex ? ' is-active' : '');
      c.getContext('2d').putImageData(
        new ImageData(new Uint8ClampedArray(item.result.rgba), c.width, c.height),
        0,
        0
      );
      c.addEventListener('click', () => {
        state.activeIndex = idx;
        renderCurrent();
        renderBatchStrip();
      });
      els.batchThumbs.appendChild(c);
    });
  }

  function downloadRgbaAsPng(rgba, width, height, filename) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    c.toBlob(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  }

  // 1ドット修正 & クリック透過操作
  function getCanvasPixelCoord(e) {
    const rect = els.canvas.getBoundingClientRect();
    const item = state.items[state.activeIndex];
    if (!item || !item.result) return null;
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * els.canvas.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * els.canvas.height);
    if (x < 0 || y < 0 || x >= item.result.width || y >= item.result.height) return null;
    return { x, y };
  }

  let isDrawing = false;
  function applyDotAction(e) {
    const item = state.items[state.activeIndex];
    if (!item || !item.result || state.viewMode !== 'result') return;
    const pt = getCanvasPixelCoord(e);
    if (!pt) return;

    const { rgba, width } = item.result;
    const idx = (pt.y * width + pt.x) * 4;

    if (state.pickBgMode) {
      if (rgba[idx + 3] > 0) {
        state.undoStack.push(new Uint8ClampedArray(rgba));
        els.btnUndoDot.disabled = false;
        item.result.rgba = Engine.removeColorBySample(
          rgba,
          width,
          item.result.height,
          [rgba[idx], rgba[idx + 1], rgba[idx + 2]],
          Number(els.optBgTol.value)
        );
        renderCurrent();
        state.pickBgMode = false;
        els.btnPickBg.classList.remove('btn-primary');
      }
      return;
    }

    if (state.dotTool === 'eyedropper') {
      if (rgba[idx + 3] > 0) {
        els.penColor.value =
          '#' + [rgba[idx], rgba[idx + 1], rgba[idx + 2]].map(v => v.toString(16).padStart(2, '0')).join('');
      }
      return;
    }

    if (!isDrawing) return;

    if (state.dotTool === 'eraser') {
      rgba[idx + 3] = 0;
    } else {
      const hex = els.penColor.value;
      rgba[idx] = parseInt(hex.slice(1, 3), 16);
      rgba[idx + 1] = parseInt(hex.slice(3, 5), 16);
      rgba[idx + 2] = parseInt(hex.slice(5, 7), 16);
      rgba[idx + 3] = 255;
    }
    renderCurrent();
  }

  els.canvas.addEventListener('pointerdown', e => {
    const item = state.items[state.activeIndex];
    if (!item || !item.result) return;
    if (!state.pickBgMode && state.dotTool !== 'eyedropper' && state.viewMode === 'result') {
      state.undoStack.push(new Uint8ClampedArray(item.result.rgba));
      if (state.undoStack.length > 20) state.undoStack.shift();
      els.btnUndoDot.disabled = false;
      isDrawing = true;
    }
    applyDotAction(e);
  });

  els.canvas.addEventListener('pointermove', e => {
    if (isDrawing) applyDotAction(e);
  });

  window.addEventListener('pointerup', () => {
    isDrawing = false;
  });

  els.btnUndoDot.addEventListener('click', () => {
    const item = state.items[state.activeIndex];
    if (!item || state.undoStack.length === 0) return;
    item.result.rgba = state.undoStack.pop();
    els.btnUndoDot.disabled = state.undoStack.length === 0;
    renderCurrent();
  });

  els.btnPickBg.addEventListener('click', () => {
    state.pickBgMode = !state.pickBgMode;
    els.btnPickBg.classList.toggle('btn-primary', state.pickBgMode);
  });

  // ファイル入力＆ドラッグドロップ
  els.fileInput.addEventListener('change', e => handleFiles(e.target.files));
  els.viewport.addEventListener('dragover', e => e.preventDefault());
  els.viewport.addEventListener('drop', e => {
    e.preventDefault();
    if (e.dataTransfer?.files) handleFiles(e.dataTransfer.files);
  });

  // プリセット切替
  document.querySelectorAll('#preset-grid .chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#preset-grid .chip').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      activePresetKey = btn.dataset.preset;
      const cfg = PRESET_CONFIGS[activePresetKey];
      els.optSize.value = String(cfg.size);
      els.optColors.value = String(cfg.colors);
      els.optDither.value = cfg.dither;
      els.optOutline.value = cfg.outline;
      reprocessAll();
    });
  });

  // 下部タブ切替
  document.querySelectorAll('.dock-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dock-tab').forEach(t => t.classList.remove('is-active'));
      document.querySelectorAll('.dock-panel').forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      document.querySelector(`.dock-panel[data-panel="${tab.dataset.tab}"]`).classList.add('is-active');
    });
  });

  // 表示モード切替
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-view]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.viewMode = btn.dataset.view;
      renderCurrent();
    });
  });

  // 1ドットツール切替
  document.querySelectorAll('[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.dotTool = btn.dataset.tool;
    });
  });

  // 設定変更時に再変換
  [
    els.optSize, els.optColors, els.optDither, els.optOutline, els.optBgMode,
    els.optBgTol, els.optSmooth, els.optHueShift, els.optDespeckle,
    els.optDejaggy, els.optVariant, els.optHueAngle, els.optSeamless, els.optLockPalette
  ].forEach(el => el.addEventListener('change', reprocessAll));

  // PNG書き出し各種
  els.btnExportPng.addEventListener('click', () => {
    const item = state.items[state.activeIndex];
    if (!item || !item.result) return;
    downloadRgbaAsPng(
      item.result.rgba,
      item.result.width,
      item.result.height,
      `${item.name}_${item.result.width}x${item.result.height}.png`
    );
  });

  els.btnExportSheet.addEventListener('click', () => {
    const frames = state.items.map(i => i.result).filter(Boolean);
    const sheet = Engine.mergeSpriteSheet(frames);
    if (!sheet) return;
    downloadRgbaAsPng(sheet.rgba, sheet.width, sheet.height, `spritesheet_${sheet.width}x${sheet.height}.png`);
  });

  els.btnExportAll.addEventListener('click', () => {
    state.items.forEach((item, idx) => {
      if (!item.result) return;
      downloadRgbaAsPng(
        item.result.rgba,
        item.result.width,
        item.result.height,
        `${item.name}_${idx + 1}_${item.result.width}x${item.result.height}.png`
      );
    });
  });
})();
