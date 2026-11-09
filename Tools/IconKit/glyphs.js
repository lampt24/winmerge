// Drawing primitives and every icon of the WinMerge "Fluent" icon set.
// All glyphs are drawn on a 32 x 32 grid; even coordinates land on whole pixels at 16 px.
'use strict';

// Palette shared with QuadPane: accent blues/cyan plus clear status colors.
// Mid-tone fills are used on purpose: the same bitmaps are shown on light and dark toolbars/menus.
const C = {
  blue: '#2F7FE0', blueD: '#1E5FBF', blueL: '#5AA2F2',
  cyan: '#22B2EE', cyanL: '#7BE6FF',
  q1: '#3B8EE6', q2: '#2C70CF', q3: '#1E53A6',
  teal: '#12A39A', violet: '#8B5CF6',
  green: '#1FA855', greenL: '#4CD07D',
  red: '#E5484D', redD: '#C4363B',
  orange: '#F2832B', amber: '#F5B400', amberL: '#FFD45C',
  gray: '#7A8699', grayL: '#AEB7C4', grayD: '#5B6678',
  paper: '#FFFFFF', paperEdge: '#8593A8', ink: '#9AA5B5',
  folder: '#F6BE4F', folderD: '#E39A2C',
  white: '#FFFFFF',
};
const PANE = { left: C.blue, middle: C.violet, right: C.teal };

const svg = (body, vb = '0 0 32 32') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
const g = (body, t) => `<g transform="${t}">${body}</g>`;
const flipX = b => g(b, 'translate(32 0) scale(-1 1)');
const flipY = b => g(b, 'translate(0 32) scale(1 -1)');
const rect = (x, y, w, h, fill, rx = 0, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const circle = (cx, cy, r, fill, extra = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" ${extra}/>`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (d, stroke, w = 2, extra = '') =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const poly = (pts, fill) => `<polygon points="${pts}" fill="${fill}"/>`;

// ---------- building blocks ----------

/** Sheet of paper with a folded corner. */
function page(x = 6, y = 2, w = 20, h = 28, o = {}) {
  const f = Math.min(8, Math.round(w * 0.36));
  const d = `M${x + 1.5} ${y}H${x + w - f}L${x + w} ${y + f}V${y + h - 1.5}a1.5 1.5 0 0 1-1.5 1.5H${x + 1.5}a1.5 1.5 0 0 1-1.5-1.5V${y + 1.5}a1.5 1.5 0 0 1 1.5-1.5Z`;
  let s = path(d, o.fill || C.paper, `stroke="${o.edge || C.paperEdge}" stroke-width="2" stroke-linejoin="round"`);
  s += path(`M${x + w - f} ${y}V${y + f - 1}a1 1 0 0 0 1 1H${x + w}`, 'none', `stroke="${o.edge || C.paperEdge}" stroke-width="2" stroke-linejoin="round"`);
  if (o.lines) {
    const n = o.lines, top = y + f + 2, step = Math.min(4, (h - f - 6) / n);
    for (let i = 0; i < n; i++) {
      const lw = (i % 3 === 2) ? (w - 8) * 0.6 : w - 8;
      s += rect(x + 4, top + i * step, lw, 2, o.lineColor || C.ink, 1);
    }
  }
  return s;
}

function folder(x = 3, y = 6, w = 26, h = 21, o = {}) {
  const back = o.back || C.folderD, front = o.front || C.folder;
  return path(`M${x} ${y + 2}a2 2 0 0 1 2-2h${w * 0.3}l3 3h${w * 0.7 - 5}a2 2 0 0 1 2 2v${h - 3}H${x}Z`, back) +
    path(`M${x} ${y + 7}a2 2 0 0 1 2-2h${w - 4}a2 2 0 0 1 2 2v${h - 9}a2 2 0 0 1-2 2H${x + 2}a2 2 0 0 1-2-2Z`, front);
}

/** Solid block arrow from (x1,y) to (x2,y), pointing right when x2 > x1. */
function harrow(x1, x2, y, color, shaft = 6, head = 14) {
  const dir = Math.sign(x2 - x1), hl = head * 0.62;
  const xs = x2 - dir * hl;
  return poly(`${x1},${y - shaft / 2} ${xs},${y - shaft / 2} ${xs},${y - head / 2} ${x2},${y} ${xs},${y + head / 2} ${xs},${y + shaft / 2} ${x1},${y + shaft / 2}`, color);
}
function varrow(x, y1, y2, color, shaft = 6, head = 14) {
  const dir = Math.sign(y2 - y1), hl = head * 0.62;
  const ys = y2 - dir * hl;
  return poly(`${x - shaft / 2},${y1} ${x - shaft / 2},${ys} ${x - head / 2},${ys} ${x},${y2} ${x + head / 2},${ys} ${x + shaft / 2},${ys} ${x + shaft / 2},${y1}`, color);
}
const chevronDown = (cx, cy, w, color, sw = 3) => line(`M${cx - w / 2} ${cy - w / 4}L${cx} ${cy + w / 4}L${cx + w / 2} ${cy - w / 4}`, color, sw);
const triangle = (cx, cy, s, dir, color) => {
  const h = s * 0.5;
  const pts = { right: `${cx - h * 0.8},${cy - h} ${cx + h},${cy} ${cx - h * 0.8},${cy + h}`,
    left: `${cx + h * 0.8},${cy - h} ${cx - h},${cy} ${cx + h * 0.8},${cy + h}`,
    down: `${cx - h},${cy - h * 0.8} ${cx + h},${cy - h * 0.8} ${cx},${cy + h}`,
    up: `${cx - h},${cy + h * 0.8} ${cx + h},${cy + h * 0.8} ${cx},${cy - h}` }[dir];
  return poly(pts, color);
};

/** Round badge with a white symbol. Ring separates it from the glyph below. */
function badge(kind, cx = 23, cy = 23, r = 8.5, color) {
  const col = color || { equal: C.green, notequal: C.red, check: C.green, plus: C.blue, minus: C.gray,
    cross: C.red, skip: C.gray, left: PANE.left, right: PANE.right, middle: PANE.middle,
    stop: C.amber, up: C.blue, info: C.blue }[kind];
  let s = circle(cx, cy, r + 1.5, C.white) + circle(cx, cy, r, col);
  const k = r / 8.5, W = C.white;
  const L = (d, w = 2.4) => line(d, W, w * k);
  switch (kind) {
    case 'equal': s += rect(cx - 4.5 * k, cy - 3.2 * k, 9 * k, 2.2 * k, W, 1) + rect(cx - 4.5 * k, cy + 1 * k, 9 * k, 2.2 * k, W, 1); break;
    case 'notequal': s += rect(cx - 4.5 * k, cy - 3.2 * k, 9 * k, 2.2 * k, W, 1) + rect(cx - 4.5 * k, cy + 1 * k, 9 * k, 2.2 * k, W, 1) +
      L(`M${cx + 2.6 * k} ${cy - 5.5 * k}L${cx - 2.6 * k} ${cy + 5.5 * k}`, 2); break;
    case 'check': s += L(`M${cx - 4 * k} ${cy}L${cx - 1 * k} ${cy + 3 * k}L${cx + 4.5 * k} ${cy - 3.5 * k}`); break;
    case 'plus': s += L(`M${cx - 4.5 * k} ${cy}H${cx + 4.5 * k}M${cx} ${cy - 4.5 * k}V${cy + 4.5 * k}`); break;
    case 'minus': s += L(`M${cx - 4.5 * k} ${cy}H${cx + 4.5 * k}`); break;
    case 'cross': s += L(`M${cx - 3.5 * k} ${cy - 3.5 * k}L${cx + 3.5 * k} ${cy + 3.5 * k}M${cx + 3.5 * k} ${cy - 3.5 * k}L${cx - 3.5 * k} ${cy + 3.5 * k}`); break;
    case 'skip': s += L(`M${cx - 4 * k} ${cy + 4 * k}L${cx + 4 * k} ${cy - 4 * k}`); break;
    case 'left': s += triangle(cx - 0.5 * k, cy, 9 * k, 'left', W); break;
    case 'right': s += triangle(cx + 0.5 * k, cy, 9 * k, 'right', W); break;
    case 'middle': s += circle(cx, cy, 3 * k, W); break;
    case 'stop': s += rect(cx - 3 * k, cy - 3 * k, 6 * k, 6 * k, W, 1); break;
    case 'up': s += triangle(cx, cy - 0.5 * k, 9 * k, 'up', W); break;
    case 'info': s += rect(cx - 1.2 * k, cy - 1.5 * k, 2.4 * k, 6 * k, W, 1) + circle(cx, cy - 4 * k, 1.4 * k, W); break;
  }
  return s;
}

// Simple stroked digits / letters so no font is needed for small glyphs.
const DIGIT = {
  0: 'M-3 -5.5h6v11h-6Z', 1: 'M-2.5 -3.5L0.5 -6V6', 2: 'M-3.5 -3.5a3.5 3 0 1 1 6 2.2L-3.5 6H4',
  3: 'M-3.5 -5.5H3L-0.5 -1a3.6 3.6 0 1 1-3.2 5.3', 4: 'M2 6V-6L-4 2.5H4.5',
  5: 'M3 -5.5H-2.8L-3.3 -0.4C-1 -2 3.8 -1.2 3.8 2.3A3.7 3.7 0 0 1-3.6 3.4',
  6: 'M2.6 -5.6Q-3.8 -4 -3.8 2.2A3.8 3.8 0 1 0 0 -1.6A3.8 3.8 0 0 0-3.8 2.2',
  7: 'M-3.6 -5.5H3.8L-1 6', 8: 'M0 -0.6A2.9 2.5 0 1 1 0 -5.6A2.9 2.5 0 1 1 0 -0.6A3.5 3.3 0 1 1 0 6A3.5 3.3 0 1 1 0 -0.6Z',
  oval: 'M0 -5.8A3.8 5.8 0 0 1 0 5.8A3.8 5.8 0 0 1 0 -5.8Z',
};
const digit = (n, cx, cy, s, color, w = 2.6) => n === 9
  ? g(line(DIGIT[6], color, w / s), `translate(${cx} ${cy}) scale(${s}) rotate(180)`)
  : g(line(DIGIT[n], color, w / s), `translate(${cx} ${cy}) scale(${s})`);

function gear(cx, cy, r, color, hole = C.white) {
  const teeth = 8, ro = r, ri = r * 0.74; let d = '';
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = (i / (teeth * 2)) * Math.PI * 2 - Math.PI / (teeth * 2) * 0.6;
    const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2 - Math.PI / (teeth * 2) * 0.6;
    const rr = i % 2 === 0 ? ro : ri;
    d += `${i === 0 ? 'M' : 'L'}${(cx + rr * Math.cos(a0)).toFixed(2)} ${(cy + rr * Math.sin(a0)).toFixed(2)}L${(cx + rr * Math.cos(a1)).toFixed(2)} ${(cy + rr * Math.sin(a1)).toFixed(2)}`;
  }
  return path(d + 'Z', color, 'stroke-linejoin="round"') + circle(cx, cy, r * 0.34, hole);
}

const magnifier = (cx = 13, cy = 13, r = 8, color = C.blue) =>
  circle(cx, cy, r, C.white, `stroke="${color}" stroke-width="3"`) +
  line(`M${cx + r * 0.72} ${cy + r * 0.72}L${cx + r * 1.7} ${cy + r * 1.7}`, color, 4.5);

/** Refresh: two arrows on a circle. */
function refresh(color1 = C.green, color2 = C.blue) {
  return line('M7 15a9 9 0 0 1 15.5-6.3', color1, 3.4) + poly('25.5,3.5 26,12.5 17.5,10.5', color1) +
    line('M25 17a9 9 0 0 1-15.5 6.3', color2, 3.4) + poly('6.5,28.5 6,19.5 14.5,21.5', color2);
}

function undoArrow(color = C.blue) {
  return line('M10 11h9.5a7.5 7.5 0 0 1 0 15H11', color, 3.6) + poly('3,11 11.5,4 11.5,18', color);
}

/** Pane column used by transfer icons. slot: 0 = left, 1 = middle, 2 = right of a 3-column layout. */
const COLX = [0, 12, 24];
function column(slot, mode, color, lines = false, y = 14, h = 16) {
  const x = COLX[slot], w = 8;
  if (mode === 'none') return '';
  if (mode === 'ghost') mode = 'outline', color = C.gray;
  if (mode === 'outline') return rect(x + 1, y + 1, w - 2, h - 2, 'none', 0, `stroke="${color}" stroke-width="2"`);
  let s = rect(x, y, w, h, color, 1);
  if (lines) for (let i = 0; i < 3; i++) s += rect(x + 2, y + 2 + i * 4, w - 4, 2, C.white);
  return s;
}
const SLOT = { left: 0, middle: 1, right: 2 };

/**
 * Copy/move between panes: arrow on top, pane columns below.
 * Source is filled (dashed when moving), target is outlined in its pane color.
 */
function transfer(from, to, o = {}) {
  let fs = SLOT[from], ts = SLOT[to];
  if (o.browse) { fs = 0; ts = 2; }
  let s = '';
  if (!o.two) for (let i = 0; i < 3; i++) if (i !== fs && i !== ts) s += column(i, 'outline', C.grayL);
  s += column(fs, o.move ? 'ghost' : 'fill', PANE[from], o.lines && !o.move);
  if (o.browse) s += folder(17, 13, 15, 16);
  else s += column(ts, 'outline', PANE[to]);
  const x1 = COLX[fs] + 4, x2 = o.browse ? 25 : COLX[ts] + 4;
  const dir = Math.sign(x2 - x1);
  s += harrow(x1 - dir * 3, x2 + dir * 4, 6, o.move ? C.orange : C.blueD, 4, 12);
  return s;
}

/** Bold plus with a white halo, readable down to 16 px. */
const plusMark = (cx, cy, r, color = C.green) =>
  line(`M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}V${cy + r}`, C.white, 7.5) +
  line(`M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}V${cy + r}`, color, 3.5);
/** Red "x" with a white halo. */
const crossMark = (cx, cy, r, color = C.red) =>
  line(`M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`, C.white, 7) +
  line(`M${cx - r} ${cy - r}L${cx + r} ${cy + r}M${cx + r} ${cy - r}L${cx - r} ${cy + r}`, color, 3.4);
/** Warning triangle with a white halo. */
const warnMark = (cx, cy, color = C.red) =>
  path(`M${cx} ${cy - 9}L${cx + 9.5} ${cy + 7}H${cx - 9.5}Z`, color, `stroke="${C.white}" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke"`) +
  rect(cx - 1.25, cy - 3.5, 2.5, 6, C.white, 1) + rect(cx - 1.25, cy + 3.5, 2.5, 2.2, C.white, 1);

// ---------- toolbar icons (order must match g_toolbarImageOrder in ToolbarButtons.cpp) ----------

const navBar = (y, color) => rect(4, y, 24, 5, color, 2.5);
const T = {
  new: () => page(4, 2, 19, 26, { lines: 3 }) + plusMark(23.5, 23.5, 5.5),
  open: () => folder(2, 5, 28, 23),
  save: () => rect(4, 4, 24, 24, C.blue, 4) + rect(9, 4, 14, 9, C.white, 1.5) + rect(18, 6, 3, 5, C.blue, 1) +
    rect(9, 18, 14, 10, C.blueD, 1.5) + rect(11, 20, 10, 2, C.blueL, 1) + rect(11, 24, 10, 2, C.blueL, 1),
  undo: () => undoArrow(),
  redo: () => flipX(undoArrow()),
  selectlinediff: () => rect(4, 4, 24, 3, C.grayL, 1.5) + rect(4, 25, 16, 3, C.grayL, 1.5) +
    rect(4, 11, 24, 10, C.amber, 2) + line('M9 9H5v14h4M23 9h4v14h-4', C.blueD, 2.4),
  nextdiff: () => navBar(24, C.amber) + varrow(16, 3, 22, C.blue, 7, 17),
  prevdiff: () => flipY(navBar(24, C.amber) + varrow(16, 3, 22, C.blue, 7, 17)),
  nextconflict: () => navBar(24, C.red) + varrow(16, 3, 22, C.blue, 7, 17),
  prevconflict: () => flipY(navBar(24, C.red) + varrow(16, 3, 22, C.blue, 7, 17)),
  firstdiff: () => navBar(3, C.amber) + flipY(chevronDown(16, 9, 18, C.blue, 4) + chevronDown(16, 17, 18, C.blue, 4)),
  curdiff: () => rect(3, 13, 26, 6, C.amber, 3) + triangle(16, 6, 12, 'down', C.blue) + triangle(16, 26, 12, 'up', C.blue),
  lastdiff: () => flipY(navBar(3, C.amber) + flipY(chevronDown(16, 9, 18, C.blue, 4) + chevronDown(16, 17, 18, C.blue, 4))),
  l2r: () => rect(2, 8, 7, 16, C.amber, 2) + harrow(11, 30, 16, C.blue, 7, 17),
  r2l: () => flipX(T.l2r()),
  l2rnext: () => rect(2, 3, 7, 14, C.amber, 2) + harrow(11, 30, 10, C.blue, 6, 15) + varrow(22, 18, 30, C.green, 5, 12),
  r2lnext: () => flipX(T.l2rnext()),
  allright: () => rect(2, 4, 7, 6, C.amber, 2) + rect(2, 13, 7, 6, C.amber, 2) + rect(2, 22, 7, 6, C.amber, 2) +
    harrow(11, 30, 16, C.blue, 7, 17) + rect(26, 3, 3, 26, C.blueD, 1.5),
  allleft: () => flipX(T.allright()),
  automerge: () => line('M4 7c7 0 9 9 14 9M4 25c7 0 9-9 14-9', C.violet, 3.6) + harrow(17, 30, 16, C.violet, 3.6, 13) +
    circle(4.5, 7, 3, C.violet) + circle(4.5, 25, 3, C.violet),
  ...navFile('firstfile', 'first'), ...navFile('prevfile', 'prev'), ...navFile('nextfile', 'next'), ...navFile('lastfile', 'last'),
  options: () => gear(16, 16, 13, C.gray),
  refresh: () => refresh(),
  choose1: () => rect(3, 3, 26, 26, PANE.left, 6) + digit(1, 16.5, 16, 1.55, C.white),
  choose2: () => rect(3, 3, 26, 26, PANE.middle, 6) + digit(2, 16, 16, 1.55, C.white),
  choose3: () => rect(3, 3, 26, 26, PANE.right, 6) + digit(3, 16.5, 16, 1.55, C.white),
};
function navFile(name, kind) {
  return { [name]: () => {
    let s = page(3, 2, 18, 24, { lines: 3 }) + circle(22, 22, 10, C.white) + circle(22, 22, 8.5, C.blue);
    const W = C.white;
    if (kind === 'first') s += rect(16.5, 17.5, 2.2, 9, W, 1) + triangle(23, 22, 9, 'left', W);
    if (kind === 'prev') s += triangle(21.5, 22, 10, 'left', W);
    if (kind === 'next') s += triangle(22.5, 22, 10, 'right', W);
    if (kind === 'last') s += rect(25.3, 17.5, 2.2, 9, W, 1) + triangle(21, 22, 9, 'right', W);
    return s;
  } };
}

const TOOLBAR_ORDER = ['new', 'open', 'save', 'undo', 'redo', 'selectlinediff', 'nextdiff', 'prevdiff',
  'nextconflict', 'prevconflict', 'firstdiff', 'curdiff', 'lastdiff', 'l2r', 'r2l', 'l2rnext', 'r2lnext',
  'allright', 'allleft', 'automerge', 'firstfile', 'prevfile', 'nextfile', 'lastfile', 'options', 'refresh',
  'choose1', 'choose2', 'choose3'];

// ---------- menu bitmaps (file name in Src/res -> glyph) ----------

const win = (x, y, w, h, color = C.blue) => rect(x, y, w, h, C.white, 2, `stroke="${color}" stroke-width="2"`) + rect(x, y, w, 5, color, 2) + rect(x, y + 3, w, 2, color);
const twoCols = (fillL, fillR) => rect(3, 5, 12, 22, fillL ? PANE.left : 'none', 2, fillL ? '' : `stroke="${C.grayL}" stroke-width="2"`) +
  rect(17, 5, 12, 22, fillR ? PANE.right : 'none', 2, fillR ? '' : `stroke="${C.grayL}" stroke-width="2"`);
const threeCols = (a, b, c) => column(0, a ? 'fill' : 'outline', a ? PANE.left : C.grayL, false, 4, 24) +
  column(1, b ? 'fill' : 'outline', b ? PANE.middle : C.grayL, false, 4, 24) + column(2, c ? 'fill' : 'outline', c ? PANE.right : C.grayL, false, 4, 24);
const bookmark = (color = C.blue) => path('M9 3h14a1.5 1.5 0 0 1 1.5 1.5V29L16 23.5 7.5 29V4.5A1.5 1.5 0 0 1 9 3Z', color);
const funnel = (color = C.blue) => path('M3 4h26l-10 12v10l-6 3V16Z', color, 'stroke-linejoin="round"');
const letterA = (color, s = 1, tx = 0, ty = 0) => g(line('M5 27L13 5h1l8 22M8.5 19h11', color, 3.4), `translate(${tx} ${ty}) scale(${s})`);
const grid = (x, y, w, h, color) => rect(x, y, w, h, C.white, 1.5, `stroke="${color}" stroke-width="2"`) +
  line(`M${x} ${y + h / 3}H${x + w}M${x} ${y + 2 * h / 3}H${x + w}M${x + w / 2} ${y}V${y + h}`, color, 2);
const mountain = (x, y) => path(`M${x} ${y + 9}l5-6 3.5 4 2.5-3 4 5Z`, C.green) + circle(x + 11, y + 1.5, 1.8, C.amber);
const globe = (cx, cy, r, color = C.blue) => circle(cx, cy, r, C.white, `stroke="${color}" stroke-width="2"`) +
  line(`M${cx - r} ${cy}H${cx + r}M${cx} ${cy - r}c-${r * 0.8} ${r * 0.6}-${r * 0.8} ${r * 1.4} 0 ${r * 2}c${r * 0.8}-${r * 0.6} ${r * 0.8}-${r * 1.4} 0-${r * 2}`, color, 1.8);
const stack3 = (inner) => page(11, 2, 18, 22) + page(4, 7, 20, 24) + g(inner, 'translate(-2 6)');
const newKind = (inner) => page(5, 2, 22, 28) + inner;
const quad = (cells) => [[3, 3], [17, 3], [3, 17], [17, 17]].map(([x, y], i) =>
  rect(x, y, 12, 12, cells[i] ? (x < 16 ? PANE.left : PANE.right) : 'none', 2.5, cells[i] ? '' : `stroke="${C.grayL}" stroke-width="2"`)).join('');

const M = {
  'copy.bmp': () => page(10, 2, 17, 21) + page(4, 9, 17, 21, { lines: 3 }),
  'cut.bmp': () => line('M10 3l10 17M22 3L12 20', C.grayD, 2.6) + circle(9, 24.5, 4.5, 'none', `stroke="${C.red}" stroke-width="2.6"`) + circle(23, 24.5, 4.5, 'none', `stroke="${C.red}" stroke-width="2.6"`),
  'paste.bmp': () => rect(4, 5, 20, 24, C.folderD, 3) + rect(9, 3, 10, 5, C.grayD, 2) + page(13, 12, 16, 18, { lines: 2 }),
  'search.bmp': () => magnifier(13, 13, 8.5),
  'cascade.bmp': () => win(2, 2, 19, 15) + win(7, 8, 19, 15) + win(12, 14, 18, 15),
  'horizontally.bmp': () => win(3, 2, 26, 13) + win(3, 17, 26, 13),
  'vertically.bmp': () => win(2, 4, 13, 24) + win(17, 4, 13, 24),
  'close.bmp': () => win(2, 3, 28, 26) + line('M11 13l10 10M21 13L11 23', C.red, 3),
  'change_pane.bmp': () => twoCols(true, false) + harrow(6, 27, 16, C.blueD, 4, 11),
  'go_to.bmp': () => rect(3, 5, 26, 3, C.grayL, 1.5) + rect(3, 24, 26, 3, C.grayL, 1.5) + harrow(3, 22, 16, C.blue, 5, 13) + rect(24, 11, 5, 10, C.amber, 1.5),
  'replace.bmp': () => letterA(C.grayD, 0.6, 1, 0) + line('M16 4c6 0 10 3 10 9', C.blue, 2.6) + poly('22,11 30,11 26,17', C.blue) + g(letterA(C.blue, 0.6), 'translate(13 13)'),
  'select_font.bmp': () => letterA(C.blue, 1, 2, 0) + rect(23, 22, 6, 6, C.amber, 1.5),
  'exit.bmp': () => rect(4, 3, 15, 26, C.grayL, 2) + rect(7, 6, 9, 20, C.white, 1) + circle(13.5, 16, 1.5, C.grayD) + harrow(15, 30, 16, C.red, 5, 12),
  'help_contents.bmp': () => circle(16, 16, 13, C.blue) + line('M11.5 12a4.5 4.5 0 1 1 6.5 4c-1.4.8-2 1.6-2 3', C.white, 3) + circle(16, 24, 1.9, C.white),
  'select_all.bmp': () => rect(4, 4, 24, 24, 'none', 2, `stroke="${C.blue}" stroke-width="2" stroke-dasharray="4 3"`) + rect(9, 10, 14, 3, C.blue, 1.5) + rect(9, 15, 14, 3, C.blue, 1.5) + rect(9, 20, 9, 3, C.blue, 1.5),
  'filters.bmp': () => funnel(),
  'customize_columns.bmp': () => rect(3, 4, 26, 24, C.white, 2, `stroke="${C.gray}" stroke-width="2"`) + rect(3, 4, 26, 6, C.blue, 2) + line('M12 4v24M21 4v24', C.gray, 2),
  'delete.bmp': () => line('M7 7l18 18M25 7L7 25', C.red, 4.5),
  'print.bmp': () => rect(9, 3, 14, 9, C.white, 1, `stroke="${C.gray}" stroke-width="2"`) + rect(3, 11, 26, 12, C.grayD, 3) + rect(9, 18, 14, 11, C.white, 1, `stroke="${C.gray}" stroke-width="2"`) + circle(24.5, 15, 1.5, C.greenL),
  'patch.bmp': () => page(5, 2, 22, 28) + rect(9, 12, 14, 3, C.green, 1.5) + rect(14.5, 9.5, 3, 8, C.green, 1.5) + rect(9, 21, 14, 3, C.red, 1.5),
  'report.bmp': () => page(5, 2, 22, 28) + rect(9, 19, 3.5, 7, C.blue, 1) + rect(14.25, 14, 3.5, 12, C.cyan, 1) + rect(19.5, 17, 3.5, 9, C.violet, 1),
  'archive.bmp': () => rect(4, 3, 24, 26, C.folder, 3) + rect(4, 3, 24, 7, C.folderD, 3) + rect(14, 3, 4, 3, C.grayD) + rect(14, 9, 4, 3, C.grayD) + rect(14, 15, 4, 3, C.grayD) + rect(12.5, 19, 7, 6, C.grayD, 1.5),
  'toggle_bookmark.bmp': () => bookmark(),
  'next_bookmark.bmp': () => g(bookmark(), 'translate(-4 0)') + varrow(25, 11, 30, C.green, 4, 11),
  'prev_bookmark.bmp': () => g(bookmark(), 'translate(-4 0)') + varrow(25, 30, 11, C.green, 4, 11),
  'clear_bookmarks.bmp': () => g(bookmark(C.grayL), 'translate(-4 0)') + crossMark(24, 23, 4.5),
  'left.bmp': () => threeCols(1, 0, 0), 'middle.bmp': () => threeCols(0, 1, 0), 'right.bmp': () => threeCols(0, 0, 1),
  'both.bmp': () => twoCols(true, true), 'all.bmp': () => threeCols(1, 1, 1),
  'zoom_in.bmp': () => magnifier(13, 13, 9) + line('M8.5 13h9M13 8.5v9', C.blue, 2.6),
  'zoom_out.bmp': () => magnifier(13, 13, 9) + line('M8.5 13h9', C.blue, 2.6),
  'open_conflict.bmp': () => page(3, 2, 20, 26, { lines: 3 }) + warnMark(22, 21),
  'plugins.bmp': () => puzzle(),
  'compare.bmp': () => page(2, 3, 14, 20, { lines: 3 }) + page(16, 9, 14, 20, { lines: 3 }) + rect(4, 16, 12, 3, C.amber, 1.5) + rect(18, 22, 10, 3, C.amber, 1.5),
  'compare_left1_left2.bmp': () => quad([1, 0, 1, 0]), 'compare_right1_right2.bmp': () => quad([0, 1, 0, 1]),
  'compare_left1_right2.bmp': () => quad([1, 0, 0, 1]), 'compare_left2_right1.bmp': () => quad([0, 1, 1, 0]),
  'new_table.bmp': () => newKind(grid(9, 12, 14, 13, C.green)),
  'new_hex.bmp': () => newKind(digit(0, 12, 19, 0.75, C.blue, 2.4) + digit(1, 19.5, 19, 0.75, C.blue, 2.4)),
  'new_image.bmp': () => newKind(mountain(9, 13)),
  'new_webpage.bmp': () => newKind(globe(16, 19, 6.5)),
  'new3.bmp': () => stack3(''),
  'new3_table.bmp': () => stack3(grid(8, 12, 12, 10, C.green)),
  'new3_hex.bmp': () => stack3(digit(0, 11, 17, 0.65, C.blue, 2.4) + digit(1, 17, 17, 0.65, C.blue, 2.4)),
  'new3_image.bmp': () => stack3(mountain(7, 12)),
  'new3_webpage.bmp': () => stack3(globe(14, 17, 5.5)),
  'new_folder.bmp': () => folder(1, 4, 26, 22) + plusMark(24, 24, 5.5),
  'compare_pr.bmp': () => line('M8 10v12', C.violet, 3) + circle(8, 7, 4, 'none', `stroke="${C.violet}" stroke-width="3"`) +
    circle(8, 25, 4, 'none', `stroke="${C.violet}" stroke-width="3"`) + circle(24, 25, 4, 'none', `stroke="${C.green}" stroke-width="3"`) +
    line('M24 21v-8a4 4 0 0 0-4-4h-4', C.green, 3) + poly('18,3 11,9 18,15', C.green),
  'mg_icons.bmp': null, // margin icons are generated separately
};
// Toolbar duplicates in the menu
Object.assign(M, {
  'new.bmp': T.new, 'open.bmp': T.open, 'save.bmp': T.save, 'undo.bmp': T.undo, 'redo.bmp': T.redo,
  'select_line_diff.bmp': T.selectlinediff, 'cur_diff.bmp': T.curdiff, 'first_diff.bmp': T.firstdiff,
  'last_diff.bmp': T.lastdiff, 'next_diff.bmp': T.nextdiff, 'prev_diff.bmp': T.prevdiff,
  'next_conflict.bmp': T.nextconflict, 'prev_conflict.bmp': T.prevconflict, 'l2r.bmp': T.l2r, 'r2l.bmp': T.r2l,
  'l2r_next.bmp': T.l2rnext, 'r2l_next.bmp': T.r2lnext, 'all_left.bmp': T.allleft, 'all_right.bmp': T.allright,
  'auto_merge.bmp': T.automerge, 'options.bmp': T.options, 'refresh.bmp': T.refresh,
});
// Pane transfers
for (const [a, b] of [['left', 'right'], ['left', 'middle'], ['right', 'left'], ['right', 'middle'], ['middle', 'left'], ['middle', 'right']]) {
  M[`copy_${a}_to_${b}.bmp`] = () => transfer(a, b);
  M[`move_${a}_to_${b}.bmp`] = () => transfer(a, b, { move: true });
  M[`selected_lines_${a}_to_${b}.bmp`] = () => transfer(a, b, { lines: true });
}
for (const a of ['left', 'middle', 'right']) {
  M[`copy_${a}_to_browse.bmp`] = () => transfer(a, 'right', { browse: true, two: true });
  M[`move_${a}_to_browse.bmp`] = () => transfer(a, 'right', { browse: true, two: true, move: true });
}
M['from_left.bmp'] = () => transfer('left', 'right', { two: true });
M['from_right.bmp'] = () => transfer('right', 'left', { two: true });
M['selected_lines_from_left.bmp'] = () => transfer('left', 'right', { two: true, lines: true });
M['selected_lines_from_right.bmp'] = () => transfer('right', 'left', { two: true, lines: true });
delete M['mg_icons.bmp'];

function puzzle(color = C.green) {
  return path('M5 9h6a3.5 3.5 0 1 1 7 0h6v6a3.5 3.5 0 1 1 0 7v6h-6a3.5 3.5 0 1 0-7 0H5v-6a3.5 3.5 0 1 0 0-7Z', color);
}

// ---------- folder-compare (DirView) status icons ----------

function fileGlyph(kind) {
  const x = 5, y = 1, w = 20, h = 26;
  switch (kind) {
    case 'text': return page(x, y, w, h, { lines: 4 });
    case 'binary': return page(x, y, w, h) + digit(0, 10.5, 17, 0.62, C.grayD, 2.4) + digit(1, 17.5, 17, 0.62, C.grayD, 2.4);
    case 'image': return page(x, y, w, h) + mountain(8.5, 12);
    case 'web': return page(x, y, w, h) + globe(15, 17, 6);
    default: return page(x, y, w, h);
  }
}
const folderGlyph = (o) => folder(1, 3, 28, 22, o);


const D = {
  'folder.ico': () => folderGlyph(),
  'fileunknown.ico': () => fileGlyph(),
  'equalfolder.ico': () => folderGlyph() + badge('equal'),
  'notequalfolder.ico': () => folderGlyph() + badge('notequal'),
  'lfolder.ico': () => folderGlyph() + badge('left'),
  'mfolder.ico': () => folderGlyph() + badge('middle'),
  'rfolder.ico': () => folderGlyph() + badge('right'),
  'lmissingfolder.ico': () => folderGlyph() + badge('minus', 23, 23, 8.5, PANE.left),
  'mmissingfolder.ico': () => folderGlyph() + badge('minus', 23, 23, 8.5, PANE.middle),
  'rmissingfolder.ico': () => folderGlyph() + badge('minus', 23, 23, 8.5, PANE.right),
  'folderskip.ico': () => folderGlyph({ back: C.gray, front: C.grayL }) + badge('skip'),
  'equalfile.ico': () => fileGlyph() + badge('equal'),
  'notequalfile.ico': () => fileGlyph() + badge('notequal'),
  'equaltextfile.ico': () => fileGlyph('text') + badge('equal'),
  'notequaltextfile.ico': () => fileGlyph('text') + badge('notequal'),
  'equalbinary.ico': () => fileGlyph('binary') + badge('equal'),
  'binarydiff.ico': () => fileGlyph('binary') + badge('notequal'),
  'equalimage.ico': () => fileGlyph('image') + badge('equal'),
  'notequalimage.ico': () => fileGlyph('image') + badge('notequal'),
  'equalwebpage.ico': () => fileGlyph('web') + badge('equal'),
  'notequalwebpage.ico': () => fileGlyph('web') + badge('notequal'),
  'lfile.ico': () => fileGlyph() + badge('left'),
  'mfile.ico': () => fileGlyph() + badge('middle'),
  'rfile.ico': () => fileGlyph() + badge('right'),
  'lmissing.ico': () => fileGlyph() + badge('minus', 23, 23, 8.5, PANE.left),
  'mmissing.ico': () => fileGlyph() + badge('minus', 23, 23, 8.5, PANE.middle),
  'rmissing.ico': () => fileGlyph() + badge('minus', 23, 23, 8.5, PANE.right),
  'fileskip.ico': () => page(5, 1, 20, 26, { fill: '#DCE1E8', edge: C.gray }) + badge('skip'),
  'error.ico': () => circle(16, 16, 13, C.red) + line('M10.5 10.5l11 11M21.5 10.5l-11 11', C.white, 3.4),
  'aborted.ico': () => circle(16, 16, 13, C.amber) + rect(11, 11, 10, 10, C.white, 2),
  'folderup.ico': () => folderGlyph() + varrow(15, 23, 11, C.white, 4, 11),
  'folderup_disable.ico': () => folderGlyph({ back: C.gray, front: C.grayL }) + varrow(15, 23, 11, C.white, 4, 11),
  'treestate_collapsed.ico': () => line('M12 8l8 8-8 8', C.gray, 3),
  'treestate_expanded.ico': () => line('M8 12l8 8 8-8', C.gray, 3),
  'plugins.ico': () => puzzle(),
  'rotate2.ico': () => refresh(C.blue, C.blue),
  'FileFilter.ico': () => page(2, 2, 18, 24, { lines: 3 }) + g(funnel(), 'translate(13 13) scale(0.55)'),
  'LineFilter.ico': () => rect(2, 5, 18, 3, C.grayL, 1.5) + rect(2, 12, 18, 3, C.amber, 1.5) + rect(2, 19, 12, 3, C.grayL, 1.5) + g(funnel(), 'translate(13 13) scale(0.55)'),
  'SubstitutionFilter.ico': () => rect(2, 4, 12, 4, C.grayL, 2) + harrow(4, 20, 14, C.blue, 3, 9) + rect(8, 20, 12, 4, C.amber, 2) + g(funnel(), 'translate(13 13) scale(0.55)'),
};
const DIR_SIZES = [16, 24, 32, 48];

// ---------- application / document icons ----------

/** WinMerge logo: two glass panes cut from one rounded square, joined by an amber difference band. */
function logo(o = {}) {
  const id = o.id || 'l';
  return `<defs>
    <linearGradient id="${id}a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.cyanL}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.q1}"/><stop offset="1" stop-color="${C.q3}"/></linearGradient>
    <clipPath id="${id}c"><rect x="16" y="16" width="224" height="224" rx="58"/></clipPath></defs>
    <g clip-path="url(#${id}c)">
      <rect x="16" y="16" width="106" height="224" rx="12" fill="url(#${id}b)"/>
      <rect x="134" y="16" width="106" height="224" rx="12" fill="url(#${id}a)"/>
      <rect x="40" y="58" width="58" height="14" rx="7" fill="#fff" fill-opacity="0.55"/>
      <rect x="40" y="86" width="40" height="14" rx="7" fill="#fff" fill-opacity="0.55"/>
      <rect x="158" y="58" width="58" height="14" rx="7" fill="#fff" fill-opacity="0.7"/>
      <rect x="158" y="86" width="40" height="14" rx="7" fill="#fff" fill-opacity="0.7"/>
      <rect x="16" y="120" width="224" height="38" fill="${C.amber}"/>
      <rect x="16" y="158" width="224" height="6" fill="#000" fill-opacity="0.12"/>
      <rect x="40" y="186" width="50" height="14" rx="7" fill="#fff" fill-opacity="0.55"/>
      <rect x="158" y="186" width="58" height="14" rx="7" fill="#fff" fill-opacity="0.7"/>
    </g>`;
}
/** Small-size logo without the decorative text lines. */
function logoSmall() {
  return `<defs><clipPath id="sc"><rect x="16" y="16" width="224" height="224" rx="52"/></clipPath></defs>
    <g clip-path="url(#sc)"><rect x="16" y="16" width="104" height="224" fill="${C.q2}"/>
    <rect x="136" y="16" width="104" height="224" fill="${C.cyan}"/>
    <rect x="16" y="112" width="224" height="48" fill="${C.amber}"/></g>`;
}
const L256 = (body) => svg(body, '0 0 256 256');
const APP = {
  'Merge.ico': (s) => L256(s <= 24 ? logoSmall() : logo()),
  'MergeDoc.ico': (s) => L256(g(page(5, 1, 22, 30).replace(/stroke-width="2"/g, 'stroke-width="1.6"'), 'scale(8)') +
    g(s <= 24 ? logoSmall() : logo({ id: 'd' }), 'translate(76 100) scale(0.52)')),
  'MergeDir.ico': (s) => L256(g(folder(1, 3, 30, 25), 'scale(8)') + g(s <= 24 ? logoSmall() : logo({ id: 'f' }), 'translate(100 104) scale(0.54)')),
  'MergeProject.ico': (s) => L256(g(page(5, 1, 22, 30).replace(/stroke-width="2"/g, 'stroke-width="1.6"'), 'scale(8)') +
    g(s <= 24 ? logoSmall() : logo({ id: 'p' }), 'translate(52 64) scale(0.48)') + g(gear(22, 23, 7.5, C.gray), 'scale(8)')),
};
const APP_SIZES = { 'Merge.ico': [16, 20, 24, 32, 40, 48, 64, 256], default: [16, 24, 32, 48, 256] };

// ---------- editor margin icons (12 px cells, drawn on a 24 grid; order = adwFlags in ccrystaltextview.cpp) ----------

const markBox = (inner) => rect(2, 2, 20, 20, C.blue, 5) + inner;
const MARGIN = [
  () => poly('2,8 12,8 12,3 22,12 12,21 12,16 2,16', C.amber),                      // execution point
  () => circle(12, 12, 9, C.red),                                                    // breakpoint
  () => circle(12, 12, 9, C.red) + line('M8 8l8 8M16 8l-8 8', C.white, 2.6),          // compilation error
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 'oval'].map(n => () => markBox(digit(n, 12, 12, 1.15, C.white, 2.4))), // bookmarks 1..9, 0
  () => path('M5 2h14a1 1 0 0 1 1 1v19l-8-5.5L4 22V3a1 1 0 0 1 1-1Z', C.blue),       // anonymous bookmark
  () => circle(12, 12, 8, C.white, `stroke="${C.red}" stroke-width="2.5"`),          // invalid breakpoint
  () => line('M5 4v7a3 3 0 0 0 3 3h10', C.gray, 2.4) + poly('15,9 21,14 15,19', C.gray), // wrapped line
];

module.exports = { MARGIN, C, svg, T, TOOLBAR_ORDER, M, D, DIR_SIZES, APP, APP_SIZES, logo, logoSmall };
