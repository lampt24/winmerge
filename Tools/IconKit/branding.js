// About-box splash (Resources/splash.png) and Open-view banner (res/logo.jpg).
'use strict';
const fs = require('fs');
const path = require('path');
const jpeg = require('jpeg-js');

const FONT = `font-family="Inter, 'Segoe UI', 'DejaVu Sans', sans-serif"`;

/** 1100 x 700, drawn under the About dialog controls: keep the left/middle and bottom plain. */
function splash(G) {
  const { C } = G;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1100" height="700" viewBox="0 0 1100 700">
  <defs>
    <linearGradient id="wash" x1="0" y1="0" x2="1" y2="0.6">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.55" stop-color="#F3F8FE"/><stop offset="1" stop-color="#DDEEFC"/>
    </linearGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/>
    </linearGradient>
  </defs>
  <rect width="1100" height="700" fill="url(#wash)"/>
  <g transform="translate(700 70) scale(1.45)" opacity="0.9">${G.logo({ id: 's' })}</g>
  <rect y="380" width="1100" height="141" fill="url(#fade)"/>
  <rect y="520" width="1100" height="180" fill="#fff"/>
  <g transform="translate(44 34) scale(0.36)">${G.logo({ id: 'w' })}</g>
  <text x="150" y="112" ${FONT} font-size="78" font-weight="700" fill="#1B2B44" letter-spacing="-1.5">Win<tspan fill="${C.q2}">Merge</tspan></text>
</svg>`;
}

/** 336 x 80 banner at the top of the Open view; the view extends it to the right with the window color. */
function banner(G) {
  const { C } = G;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="336" height="80" viewBox="0 0 336 80">
  <rect width="336" height="80" fill="#FFFFFF"/>
  <g transform="translate(14 12) scale(0.22)">${G.logo({ id: 'b' })}</g>
  <text x="82" y="47" ${FONT} font-size="30" font-weight="700" fill="#1B2B44" letter-spacing="-0.5">Win<tspan fill="${C.q2}">Merge</tspan></text>
  <text x="83" y="64" ${FONT} font-size="11.5" fill="#5B6678">Compare and merge files and folders</text>
</svg>`;
}

function write(out, io, G) {
  const sp = io.flatten(io.render(splash(G), 1100, 700), [255, 255, 255]);
  io.writePng(path.join(out, 'splash.png'), 1100, 700, sp);
  const bn = io.flatten(io.render(banner(G), 336, 80), [255, 255, 255]);
  fs.writeFileSync(path.join(out, 'logo.jpg'), jpeg.encode({ data: bn, width: 336, height: 80 }, 95).data);
  io.writePng(path.join(out, 'logo.png'), 336, 80, bn);
}

module.exports = { write, splash, banner };
