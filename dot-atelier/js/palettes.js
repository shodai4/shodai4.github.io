(function (global) {
  'use strict';

  const PRESET_PALETTES = {
    // ファミコン風代表16色
    fc: [
      [124, 124, 124], [0, 0, 252], [0, 0, 188], [68, 40, 188],
      [148, 0, 132], [168, 0, 32], [168, 16, 0], [136, 20, 0],
      [80, 48, 0], [0, 120, 0], [0, 104, 0], [0, 88, 0],
      [0, 64, 88], [0, 0, 0], [188, 188, 188], [248, 248, 248]
    ],
    // ゲームボーイ風4階調
    gb: [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15]
    ],
    // PICO-8 標準16色
    pico8: [
      [0, 0, 0], [29, 43, 83], [126, 37, 83], [0, 135, 81],
      [171, 82, 54], [95, 87, 79], [194, 195, 199], [255, 241, 232],
      [255, 0, 77], [255, 163, 0], [255, 236, 39], [0, 228, 54],
      [41, 173, 255], [131, 118, 156], [255, 119, 168], [255, 204, 170]
    ]
  };

  const PRESET_CONFIGS = {
    custom: { size: 32, colors: 16, dither: 'none', outline: 'black', paletteKey: null },
    fc: { size: 32, colors: 16, dither: 'none', outline: 'black', paletteKey: 'fc' },
    gb: { size: 32, colors: 4, dither: 'bayer4', outline: 'colortrace', paletteKey: 'gb' },
    pico8: { size: 32, colors: 16, dither: 'none', outline: 'black', paletteKey: 'pico8' },
    rpgmaker: { size: 48, colors: 24, dither: 'none', outline: 'colortrace', paletteKey: null },
    icon64: { size: 64, colors: 32, dither: 'none', outline: 'colortrace', paletteKey: null }
  };

  const exported = { PRESET_PALETTES, PRESET_CONFIGS };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    global.DotPalettes = exported;
  }
})(typeof window !== 'undefined' ? window : globalThis);
