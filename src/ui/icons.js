const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.8',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

function svg(paths, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${paths}</svg>`;
}

function p(d, extra = '') {
  return `<path d="${d}" ${Object.entries(stroke).map(([k, v]) => `${k}="${v}"`).join(' ')} ${extra}/>`;
}

function c(cx, cy, r) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" ${Object.entries(stroke).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
}

function r(x, y, w, h, rx = 0) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${Object.entries(stroke).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
}

function l(x1, y1, x2, y2) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${Object.entries(stroke).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
}

export const icons = {
  logo: 'L',
  select: svg(p('M4 4l7 16 2.5-6.5L20 11z')),
  hand: svg(p('M8 13V7a1.5 1.5 0 013 0v4') + p('M11 11V5.5a1.5 1.5 0 013 0V11') + p('M14 11V7a1.5 1.5 0 013 0v7a5 5 0 01-5 5h-1a6 6 0 01-6-6v-2a1.5 1.5 0 013 0v2')),
  text: svg(p('M5 7h14') + p('M12 7v12') + p('M8 19h8')),
  editText: svg(
    p('M5 6h9') +
    p('M9.5 6v12') +
    p('M6.5 18h6') +
    p('M14 15.5l4.8-4.8a1.4 1.4 0 012 2L16 17.5l-2.5.6z'),
  ),
  pen: svg(p('M4 20l4.5-1.2L19 8.3a2.1 2.1 0 00-3-3L5.5 15.8 4 20z')),
  highlight: svg(p('M4 17l4 3 12-12-4-4L4 17z') + p('M14 6l4 4')),
  rect: svg(r(5, 6, 14, 12, 2)),
  ellipse: svg(c(12, 12, 7)),
  line: svg(l(5, 19, 19, 5)),
  arrow: svg(p('M5 19L19 5') + p('M11 5h8v8')),
  image: svg(r(4, 5, 16, 14, 2) + c(9, 10, 1.5) + p('M4 16l5-4 3 2 4-5 4 4')),
  signature: svg(p('M4 17c2-3 3.5-4 5-4s2.5 2 4 2 3-3 5-5') + p('M4 20h16')),
  stamp: svg(r(6, 13, 12, 6, 1) + p('M8 13V9a4 4 0 018 0v4')),
  eraser: svg(p('M6 16l8-8 4 4-8 8H6v-4z') + p('M9 19h11')),
  redaction: svg(r(4, 9, 16, 6, 1) + p('M7 12h10')),
  sticky: svg(p('M7 4h8l5 5v11a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z') + p('M15 4v5h5')),
  undo: svg(p('M9 7L5 11l4 4') + p('M5 11h9a5 5 0 010 10H9')),
  redo: svg(p('M15 7l4 4-4 4') + p('M19 11H10a5 5 0 000 10h5')),
  zoomIn: svg(c(11, 11, 6) + l(21, 21, 16.5, 16.5) + l(11, 8, 11, 14) + l(8, 11, 14, 11)),
  zoomOut: svg(c(11, 11, 6) + l(21, 21, 16.5, 16.5) + l(8, 11, 14, 11)),
  fit: svg(p('M4 9V5h4') + p('M20 9V5h-4') + p('M4 15v4h4') + p('M20 15v4h-4')),
  rotate: svg(p('M20 12a8 8 0 11-2.3-5.7') + p('M20 5v5h-5')),
  pages: svg(r(7, 4, 10, 16, 1.5) + p('M10 8h4') + p('M10 12h4') + p('M10 16h3')),
  addPage: svg(r(7, 4, 10, 16, 1.5) + l(12, 10, 12, 16) + l(9, 13, 15, 13)),
  deletePage: svg(r(7, 4, 10, 16, 1.5) + l(10, 11, 14, 15) + l(14, 11, 10, 15)),
  merge: svg(p('M8 7h4a4 4 0 010 8H8') + p('M16 7h-1') + p('M16 15h-1') + p('M8 7V5') + p('M8 15v2')),
  split: svg(p('M8 5v14') + p('M16 5v14') + l(8, 12, 16, 12)),
  watermark: svg(c(12, 12, 8) + p('M8.5 12.5l2.2 2.2 4.8-5')),
  number: svg(r(6, 5, 12, 14, 2) + p('M10 9h4') + p('M10 13h4') + p('M10 17h2')),
  download: svg(p('M12 4v10') + p('M8 10l4 4 4-4') + p('M5 19h14')),
  upload: svg(p('M12 20V10') + p('M8 14l4-4 4 4') + p('M5 5h14')),
  html: svg(p('M8 8l-4 4 4 4') + p('M16 8l4 4-4 4') + p('M13 6l-2 12')),
  menu: svg(l(5, 8, 19, 8) + l(5, 12, 19, 12) + l(5, 16, 19, 16)),
  close: svg(l(7, 7, 17, 17) + l(17, 7, 7, 17)),
  check: svg(p('M5 13l4 4L19 7')),
  trash: svg(p('M5 8h14') + p('M9 8V6h6v2') + p('M7 8l1 12h8l1-12')),
  settings: svg(c(12, 12, 3) + p('M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4')),
  more: svg(c(6, 12, 1.2) + c(12, 12, 1.2) + c(18, 12, 1.2)),
};
