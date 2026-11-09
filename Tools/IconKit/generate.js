#!/usr/bin/env node
// Regenerates WinMerge's toolbar strip, menu bitmaps, folder-compare icons, app icons,
// splash and Open-view logo from the vector sources in glyphs.js / branding.js.
//
//   cd Tools/IconKit && npm install && node generate.js [--out ../../Src/res] [--preview preview.png]
'use strict';
const fs = require('fs');
const path = require('path');
const io = require('./io');
const G = require('./glyphs');
const branding = require('./branding');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const OUT = path.resolve(__dirname, opt('--out', '../../Src/res'));
const PREVIEW = opt('--preview', null);
io.setFontFiles([path.join(__dirname, 'fonts', 'Inter.ttf')]);

const sq = (body, size) => io.render(G.svg(body), size, size);

/** Menu bitmaps are 16 x 15: render on the 16 px grid, then drop whichever edge row carries less ink. */
function menuBitmap(body) {
  const full = sq(body, 16);
  const ink = row => { let n = 0; for (let x = 0; x < 16; x++) n += full[(row * 16 + x) * 4 + 3]; return n; };
  const start = ink(15) <= ink(0) ? 0 : 1;
  return full.subarray(start * 16 * 4, (start + 15) * 16 * 4);
}

// 1. Toolbar: one 64 x 62 cell per command (same 32:31 aspect as the original strip).
//    LoadPngResourceToImageList() scales each cell to N x (N - 1) for N = 16/24/32/40 px.
const TB = 64, TBH = 62;
const tbImages = G.TOOLBAR_ORDER.map(n => io.render(G.svg(G.T[n](), '0 0.5 32 31'), TB, TBH));
io.writePng(path.join(OUT, 'ToolbarEnabled32.png'), TB * tbImages.length, TBH, io.hstrip(tbImages, TB, TBH));

// 2. Menu bitmaps: 16 x 15, magenta color key (BCMenu).
const menuNames = Object.keys(G.M);
for (const name of menuNames) {
  io.writeKeyedBmp(path.join(OUT, name), 16, 15, menuBitmap(G.M[name]()));
}

// 2b. Editor margin icons: 16 cells of 12 px (the Direct2D renderer reads 12 px source cells).
const mg = G.MARGIN.map(fn => io.render(G.svg(fn(), '0 0 24 24'), 12, 12));
io.writePng(path.join(OUT, 'mg_icons.png'), 12 * mg.length, 12, io.hstrip(mg, 12, 12));
io.writeKeyedBmp(path.join(OUT, 'mg_icons.bmp'), 12 * mg.length, 12, io.hstrip(mg, 12, 12));

// 3. Folder compare icons.
for (const [name, fn] of Object.entries(G.D)) {
  const body = fn();
  io.writeIco(path.join(OUT, name), G.DIR_SIZES.map(s => ({ size: s, rgba: sq(body, s) })));
}

// 4. Application and document icons (also copied to the shell extension).
for (const [name, fn] of Object.entries(G.APP)) {
  const sizes = G.APP_SIZES[name] || G.APP_SIZES.default;
  io.writeIco(path.join(OUT, name), sizes.map(s => ({ size: s, rgba: io.render(fn(s), s, s) })));
}
const shellRes = path.resolve(__dirname, '../../ShellExtension/Resources');
if (fs.existsSync(shellRes) && OUT === path.resolve(__dirname, '../../Src/res')) {
  fs.copyFileSync(path.join(OUT, 'Merge.ico'), path.join(shellRes, 'WinMerge.ico'));
  fs.copyFileSync(path.join(OUT, 'MergeDir.ico'), path.join(shellRes, 'WinMergeDir.ico'));
}

// 5. Branding bitmaps.
branding.write(OUT, io, G);

console.log(`toolbar ${tbImages.length}, menu ${menuNames.length}, dirview ${Object.keys(G.D).length}, app ${Object.keys(G.APP).length} -> ${OUT}`);

// Optional contact sheet for review, on a light and a dark background.
if (PREVIEW) {
  const cell = 40, cols = 16;
  const items = [
    ...G.TOOLBAR_ORDER.map(n => ({ s: G.svg(G.T[n]()), w: 32, h: 32 })),
    ...menuNames.map(n => ({ s: G.svg(G.M[n]()), w: 16, h: 16 })),
    ...Object.values(G.D).map(f => ({ s: G.svg(f()), w: 16, h: 16 })),
    ...Object.values(G.D).map(f => ({ s: G.svg(f()), w: 32, h: 32 })),
    ...Object.values(G.APP).map(f => ({ s: f(48), w: 32, h: 32 })),
  ];
  const rows = Math.ceil(items.length / cols);
  const W = cols * cell * 2, H = rows * cell;
  const sheet = Buffer.alloc(W * H * 4);
  const bgs = [[249, 249, 249], [32, 32, 32]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const bg = bgs[x < W / 2 ? 0 : 1], p = (y * W + x) * 4;
    sheet[p] = bg[0]; sheet[p + 1] = bg[1]; sheet[p + 2] = bg[2]; sheet[p + 3] = 255;
  }
  items.forEach((it, i) => {
    const rgba = io.render(it.s, it.w, it.h);
    for (const half of [0, 1]) {
      const ox = half * W / 2 + (i % cols) * cell + (cell - it.w) / 2, oy = Math.floor(i / cols) * cell + (cell - it.h) / 2;
      for (let y = 0; y < it.h; y++) for (let x = 0; x < it.w; x++) {
        const s = (y * it.w + x) * 4, d = ((oy + y) * W + ox + x) * 4, a = rgba[s + 3] / 255;
        for (let k = 0; k < 3; k++) sheet[d + k] = Math.round(rgba[s + k] * a + sheet[d + k] * (1 - a));
      }
    }
  });
  io.writePng(path.resolve(PREVIEW), W, H, sheet);
  console.log('preview', path.resolve(PREVIEW));
}
