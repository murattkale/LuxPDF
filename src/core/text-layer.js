import * as pdfjs from 'pdfjs-dist';
import { getPdfJsDoc } from './pdf-engine.js';
import { state, getPageAnnos, uid, pushHistory } from './state.js';
import { textItemCache, clearTextCache } from './text-cache.js';

export { clearTextCache };

/**
 * @typedef {Object} NativeTextItem
 * @property {string} id
 * @property {number} page
 * @property {string} text
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} fontSize
 * @property {string} [fontName]
 */

export async function getPageTextItems(pageNum) {
  if (textItemCache.has(pageNum)) return textItemCache.get(pageNum);
  const pdf = await getPdfJsDoc();
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent({ includeMarkedContent: false });
  const raw = [];

  for (let i = 0; i < content.items.length; i++) {
    const item = content.items[i];
    if (!item.str || !String(item.str).trim()) continue;

    const tx = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]) || Math.hypot(item.transform[2], item.transform[3]) || 12;
    const horiz = Math.hypot(tx[0], tx[1]) || 1;
    const width = (item.width || 0) * (horiz / (Math.hypot(item.transform[0], item.transform[1]) || 1));
    const x = tx[4];
    const y = tx[5] - fontHeight;

    raw.push({
      id: `nt_${pageNum}_${i}`,
      page: pageNum,
      text: item.str,
      x,
      y,
      w: Math.max(width, fontHeight * 0.35),
      h: fontHeight * 1.15,
      fontSize: fontHeight,
      fontName: item.fontName || 'Helvetica',
    });
  }

  const merged = mergeLineItems(raw);
  textItemCache.set(pageNum, merged);
  return merged;
}

function mergeLineItems(items) {
  if (!items.length) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const lines = [];
  let current = null;

  for (const item of sorted) {
    if (!current) {
      current = { ...item, parts: [item] };
      continue;
    }
    const sameLine = Math.abs(item.y - current.y) < Math.max(current.fontSize, item.fontSize) * 0.45;
    const gap = item.x - (current.x + current.w);
    const close = gap < Math.max(current.fontSize, item.fontSize) * 0.85;
    if (sameLine && gap > -2 && close) {
      const space = gap > current.fontSize * 0.18 ? ' ' : '';
      current.text += space + item.text;
      current.w = item.x + item.w - current.x;
      current.h = Math.max(current.h, item.h);
      current.fontSize = Math.max(current.fontSize, item.fontSize);
      current.parts.push(item);
    } else {
      lines.push(finalizeMerged(current));
      current = { ...item, parts: [item] };
    }
  }
  if (current) lines.push(finalizeMerged(current));
  return lines;
}

function finalizeMerged(line) {
  return {
    id: line.id,
    page: line.page,
    text: line.text.replace(/\s+/g, ' ').trim(),
    x: line.x,
    y: line.y,
    w: line.w,
    h: line.h,
    fontSize: line.fontSize,
    fontName: guessFont(line.fontName),
  };
}

function guessFont(name = '') {
  const n = name.toLowerCase();
  if (n.includes('courier')) return 'Courier';
  if (n.includes('times') || n.includes('roman') || n.includes('serif')) return 'Times';
  if (n.includes('bold')) return 'Helvetica-Bold';
  return 'Helvetica';
}

export function findNativeTextAt(pageItems, cssX, cssY, scale = state.scale) {
  const x = cssX / scale;
  const y = cssY / scale;
  for (let i = pageItems.length - 1; i >= 0; i--) {
    const t = pageItems[i];
    if (x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h) return t;
  }
  return null;
}

export function findTextEditForNative(page, nativeId) {
  return getPageAnnos(page).find((a) => a.type === 'textEdit' && a.data.nativeId === nativeId) || null;
}

export function upsertTextEdit(nativeItem, newText, extras = {}) {
  pushHistory();
  const existing = findTextEditForNative(nativeItem.page, nativeItem.id);
  const padX = 1.5;
  const padY = 1;
  const data = {
    nativeId: nativeItem.id,
    originalText: nativeItem.text,
    text: newText,
    x: nativeItem.x - padX,
    y: nativeItem.y - padY,
    w: Math.max(nativeItem.w + padX * 2, extras.w || nativeItem.w),
    h: nativeItem.h + padY * 2,
    fontSize: extras.fontSize ?? nativeItem.fontSize,
    fontFamily: extras.fontFamily ?? nativeItem.fontName ?? 'Helvetica',
    color: extras.color ?? '#12181f',
    coverColor: extras.coverColor ?? '#ffffff',
    opacity: 1,
  };

  if (existing) {
    existing.data = { ...existing.data, ...data, originalText: existing.data.originalText || nativeItem.text };
    state.selectedAnno = existing;
    return existing;
  }

  const anno = {
    id: uid('textEdit'),
    type: 'textEdit',
    page: nativeItem.page,
    data,
  };
  getPageAnnos(nativeItem.page).push(anno);
  state.selectedAnno = anno;
  return anno;
}

export function measureTextWidth(text, fontSize, fontFamily = 'Helvetica') {
  const canvas = measureTextWidth._c || (measureTextWidth._c = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px ${fontFamily}, sans-serif`;
  return ctx.measureText(text || ' ').width;
}
