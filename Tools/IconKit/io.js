// Image writers used by the icon kit: PNG strips, 24-bit color-keyed BMP, multi-size ICO, baseline JPEG.
'use strict';
const fs = require('fs');
const { PNG } = require('pngjs');
const { Resvg } = require('@resvg/resvg-js');

let fontFiles = [];
function setFontFiles(files) { fontFiles = files.filter(f => fs.existsSync(f)); }

/** Render an SVG string to straight (non-premultiplied) RGBA at exactly w x h. */
function render(svg, w, h) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: w },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Inter' },
    shapeRendering: 2, textRendering: 2,
  });
  const img = r.render();
  if (img.width !== w || img.height !== h)
    throw new Error(`render size ${img.width}x${img.height} != ${w}x${h}`);
  return Buffer.from(img.pixels);
}

function writePng(file, w, h, rgba) {
  const png = new PNG({ width: w, height: h });
  rgba.copy(png.data);
  fs.writeFileSync(file, PNG.sync.write(png, { colorType: 6 }));
}

/** Concatenate equally sized RGBA images horizontally. */
function hstrip(images, w, h) {
  const out = Buffer.alloc(w * images.length * h * 4);
  images.forEach((img, i) => {
    for (let y = 0; y < h; y++)
      img.copy(out, (y * w * images.length + i * w) * 4, y * w * 4, (y + 1) * w * 4);
  });
  return out;
}

/**
 * 24-bit BMP for BCMenu: transparent pixels become magenta (BCMenu's color key).
 * Partially covered pixels are kept when at least half covered, so edges stay crisp
 * on both the light and the dark menu background.
 */
function writeKeyedBmp(file, w, h, rgba) {
  const stride = Math.ceil(w * 3 / 4) * 4;
  const b = Buffer.alloc(54 + stride * h);
  b.write('BM'); b.writeUInt32LE(b.length, 2); b.writeUInt32LE(54, 10);
  b.writeUInt32LE(40, 14); b.writeInt32LE(w, 18); b.writeInt32LE(h, 22);
  b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(stride * h, 34);
  b.writeInt32LE(2835, 38); b.writeInt32LE(2835, 42);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4, o = 54 + (h - 1 - y) * stride + x * 3;
      let r = 255, g = 0, bl = 255;
      if (rgba[p + 3] >= 110) {
        r = rgba[p]; g = rgba[p + 1]; bl = rgba[p + 2];
        if (r === 255 && g === 0 && bl === 255) g = 1; // never collide with the key
      }
      b[o] = bl; b[o + 1] = g; b[o + 2] = r;
    }
  fs.writeFileSync(file, b);
}

/** 32-bit DIB (BITMAPINFOHEADER + XOR + AND mask) for an ICO entry. */
function dibEntry(w, h, rgba) {
  const maskStride = Math.ceil(w / 32) * 4;
  const b = Buffer.alloc(40 + w * h * 4 + maskStride * h);
  b.writeUInt32LE(40, 0); b.writeInt32LE(w, 4); b.writeInt32LE(h * 2, 8);
  b.writeUInt16LE(1, 12); b.writeUInt16LE(32, 14);
  b.writeUInt32LE(w * h * 4 + maskStride * h, 20);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4, o = 40 + ((h - 1 - y) * w + x) * 4;
      b[o] = rgba[p + 2]; b[o + 1] = rgba[p + 1]; b[o + 2] = rgba[p]; b[o + 3] = rgba[p + 3];
      if (rgba[p + 3] === 0) {
        const mo = 40 + w * h * 4 + (h - 1 - y) * maskStride + (x >> 3);
        b[mo] |= 0x80 >> (x & 7);
      }
    }
  return b;
}

/** Multi-resolution ICO. 256 px is stored as PNG, smaller sizes as 32-bit DIBs. */
function writeIco(file, entries) {
  const datas = entries.map(e => {
    if (e.size >= 256) {
      const png = new PNG({ width: e.size, height: e.size });
      e.rgba.copy(png.data);
      return PNG.sync.write(png, { colorType: 6 });
    }
    return dibEntry(e.size, e.size, e.rgba);
  });
  const head = Buffer.alloc(6 + 16 * entries.length);
  head.writeUInt16LE(1, 2); head.writeUInt16LE(entries.length, 4);
  let off = head.length;
  entries.forEach((e, i) => {
    const o = 6 + 16 * i;
    head[o] = e.size >= 256 ? 0 : e.size; head[o + 1] = e.size >= 256 ? 0 : e.size;
    head.writeUInt16LE(1, o + 4); head.writeUInt16LE(32, o + 6);
    head.writeUInt32LE(datas[i].length, o + 8); head.writeUInt32LE(off, o + 12);
    off += datas[i].length;
  });
  fs.writeFileSync(file, Buffer.concat([head, ...datas]));
}

/** Flatten RGBA over a solid background color. */
function flatten(rgba, bg) {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3] / 255;
    for (let k = 0; k < 3; k++) out[i + k] = Math.round(out[i + k] * a + bg[k] * (1 - a));
    out[i + 3] = 255;
  }
  return out;
}

module.exports = { setFontFiles, render, writePng, hstrip, writeKeyedBmp, writeIco, flatten };
