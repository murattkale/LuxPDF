import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument, rgb, degrees, StandardFonts, PageSizes } from 'pdf-lib';
import { state, resetDocumentState, getPageAnnos } from './state.js';
import { clearTextCache } from './text-cache.js';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const thumbCache = new Map();
let loadingTask = null;

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
  };
}

export async function loadPdfFromBytes(bytes, fileName = 'document.pdf') {
  if (loadingTask) {
    try { await loadingTask.destroy(); } catch { /* ignore */ }
  }
  thumbCache.clear();
  clearTextCache();
  resetDocumentState();

  const copy = bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes);
  state.pdfBytes = copy;
  state.fileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  state.pdfDoc = await PDFDocument.load(copy, { ignoreEncryption: true, updateMetadata: false });
  state.pageCount = state.pdfDoc.getPageCount();

  loadingTask = pdfjs.getDocument({ data: copy.slice() });
  const pdf = await loadingTask.promise;
  state.pageSizes = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 });
    state.pageSizes.push({ width: vp.width, height: vp.height });
  }
  return pdf;
}

export async function getPdfJsDoc() {
  if (!state.pdfBytes) return null;
  loadingTask = pdfjs.getDocument({ data: state.pdfBytes.slice() });
  return loadingTask.promise;
}

export async function renderPageToCanvas(pageNum, canvas, scale = state.scale) {
  const pdf = await getPdfJsDoc();
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: scale * state.dpr });
  const ctx = canvas.getContext('2d', { alpha: false });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / state.dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / state.dpr)}px`;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  return {
    cssWidth: viewport.width / state.dpr,
    cssHeight: viewport.height / state.dpr,
  };
}

export async function renderThumb(pageNum, canvas, maxW = 160) {
  if (thumbCache.has(pageNum)) {
    const cached = thumbCache.get(pageNum);
    canvas.width = cached.width;
    canvas.height = cached.height;
    canvas.getContext('2d').drawImage(cached, 0, 0);
    return;
  }
  const pdf = await getPdfJsDoc();
  const page = await pdf.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = maxW / base.width;
  const viewport = page.getViewport({ scale });
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const off = document.createElement('canvas');
  off.width = canvas.width;
  off.height = canvas.height;
  off.getContext('2d').drawImage(canvas, 0, 0);
  thumbCache.set(pageNum, off);
}

export function invalidateThumbs(fromPage = 1) {
  for (const key of [...thumbCache.keys()]) {
    if (key >= fromPage) thumbCache.delete(key);
  }
}

export async function syncBytesFromDoc() {
  state.pdfBytes = await state.pdfDoc.save({ useObjectStreams: true });
  state.pageCount = state.pdfDoc.getPageCount();
  invalidateThumbs();
}

export async function rotatePage(pageIndex, angle = 90) {
  const page = state.pdfDoc.getPage(pageIndex);
  const current = page.getRotation().angle;
  page.setRotation(degrees((current + angle + 360) % 360));
  await syncBytesFromDoc();
}

export async function deletePage(pageIndex) {
  if (state.pageCount <= 1) throw new Error('En az bir sayfa kalmalı');
  state.pdfDoc.removePage(pageIndex);
  const next = new Map();
  for (const [p, list] of state.annotations.entries()) {
    if (p === pageIndex + 1) continue;
    const np = p > pageIndex + 1 ? p - 1 : p;
    next.set(np, list.map((a) => ({ ...a, page: np })));
  }
  state.annotations = next;
  await syncBytesFromDoc();
  if (state.currentPage > state.pageCount) state.currentPage = state.pageCount;
}

export async function addBlankPage(afterIndex = state.pageCount - 1) {
  const ref = state.pdfDoc.getPage(Math.max(0, afterIndex));
  const { width, height } = ref.getSize();
  state.pdfDoc.insertPage(afterIndex + 1, [0, 0, width, height]);
  await syncBytesFromDoc();
}

export async function duplicatePage(pageIndex) {
  const [copied] = await state.pdfDoc.copyPages(state.pdfDoc, [pageIndex]);
  state.pdfDoc.insertPage(pageIndex + 1, copied);
  await syncBytesFromDoc();
}

export async function movePage(from, to) {
  if (from === to) return;
  const [page] = await state.pdfDoc.copyPages(state.pdfDoc, [from]);
  state.pdfDoc.removePage(from);
  const insertAt = from < to ? to - 1 : to;
  state.pdfDoc.insertPage(insertAt, page);
  await syncBytesFromDoc();
}

export async function mergePdfBytes(otherBytes) {
  const other = await PDFDocument.load(otherBytes, { ignoreEncryption: true });
  const pages = await state.pdfDoc.copyPages(other, other.getPageIndices());
  pages.forEach((p) => state.pdfDoc.addPage(p));
  await syncBytesFromDoc();
}

export async function extractPages(indices) {
  const out = await PDFDocument.create();
  const pages = await out.copyPages(state.pdfDoc, indices);
  pages.forEach((p) => out.addPage(p));
  return out.save();
}

export async function addWatermark(text, options = {}) {
  const {
    opacity = 0.18,
    fontSize = 48,
    color = '#0f766e',
    rotate = -32,
  } = options;
  const font = await state.pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const c = hexToRgb(color);
  for (const page of state.pdfDoc.getPages()) {
    const { width, height } = page.getSize();
    const tw = font.widthOfTextAtSize(text, fontSize);
    page.drawText(text, {
      x: (width - tw) / 2,
      y: height / 2,
      size: fontSize,
      font,
      color: rgb(c.r, c.g, c.b),
      opacity,
      rotate: degrees(rotate),
    });
  }
  await syncBytesFromDoc();
}

export async function addPageNumbers(format = 'n / N') {
  const font = await state.pdfDoc.embedFont(StandardFonts.Helvetica);
  const total = state.pdfDoc.getPageCount();
  state.pdfDoc.getPages().forEach((page, i) => {
    const label = format.replace('n', String(i + 1)).replace('N', String(total));
    const { width } = page.getSize();
    const size = 10;
    const tw = font.widthOfTextAtSize(label, size);
    page.drawText(label, {
      x: (width - tw) / 2,
      y: 18,
      size,
      font,
      color: rgb(0.35, 0.4, 0.45),
    });
  });
  await syncBytesFromDoc();
}

function drawStrokeOnPage(page, stroke, pageHeight) {
  const c = hexToRgb(stroke.color);
  const pts = stroke.points;
  if (pts.length < 2) return;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    page.drawLine({
      start: { x: a.x, y: pageHeight - a.y },
      end: { x: b.x, y: pageHeight - b.y },
      thickness: stroke.width,
      color: rgb(c.r, c.g, c.b),
      opacity: stroke.opacity ?? 1,
      lineCap: 1,
    });
  }
}

async function embedImageData(doc, dataUrl) {
  const res = await fetch(dataUrl);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (dataUrl.includes('image/png') || dataUrl.startsWith('data:image/png')) {
    return doc.embedPng(bytes);
  }
  return doc.embedJpg(bytes);
}

export async function buildAnnotatedPdf() {
  const doc = await PDFDocument.load(state.pdfBytes.slice(), { ignoreEncryption: true });
  const fontCache = {};
  const fontFor = async (name) => {
    const map = {
      Helvetica: StandardFonts.Helvetica,
      'Helvetica-Bold': StandardFonts.HelveticaBold,
      Times: StandardFonts.TimesRoman,
      Courier: StandardFonts.Courier,
    };
    const key = map[name] || StandardFonts.Helvetica;
    if (!fontCache[key]) fontCache[key] = await doc.embedFont(key);
    return fontCache[key];
  };

  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const annos = getPageAnnos(i + 1);
    for (const anno of annos) {
      const d = anno.data;
      if (anno.type === 'pen' || anno.type === 'highlight') {
        drawStrokeOnPage(page, {
          ...d,
          width: anno.type === 'highlight' ? (d.width || 16) : d.width,
          opacity: anno.type === 'highlight' ? 0.35 : (d.opacity ?? 1),
        }, height);
      } else if (anno.type === 'rect' || anno.type === 'redaction') {
        const c = hexToRgb(d.color || '#000000');
        const fill = anno.type === 'redaction' ? rgb(0, 0, 0) : (d.fill ? rgb(...Object.values(hexToRgb(d.fill)).slice(0, 3)) : undefined);
        page.drawRectangle({
          x: d.x,
          y: height - d.y - d.h,
          width: d.w,
          height: d.h,
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: anno.type === 'redaction' ? 0 : (d.strokeWidth || 2),
          color: anno.type === 'redaction' ? rgb(0, 0, 0) : fill,
          opacity: d.opacity ?? 1,
        });
      } else if (anno.type === 'ellipse') {
        const c = hexToRgb(d.color || '#0f766e');
        page.drawEllipse({
          x: d.x + d.w / 2,
          y: height - d.y - d.h / 2,
          xScale: Math.abs(d.w / 2),
          yScale: Math.abs(d.h / 2),
          borderColor: rgb(c.r, c.g, c.b),
          borderWidth: d.strokeWidth || 2,
          color: d.fill ? rgb(...Object.values(hexToRgb(d.fill)).slice(0, 3)) : undefined,
          opacity: d.opacity ?? 1,
        });
      } else if (anno.type === 'line' || anno.type === 'arrow') {
        const c = hexToRgb(d.color || '#0f766e');
        page.drawLine({
          start: { x: d.x1, y: height - d.y1 },
          end: { x: d.x2, y: height - d.y2 },
          thickness: d.strokeWidth || 2,
          color: rgb(c.r, c.g, c.b),
          opacity: d.opacity ?? 1,
        });
        if (anno.type === 'arrow') {
          const ang = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
          const ah = 12;
          const left = ang + Math.PI * 0.8;
          const right = ang - Math.PI * 0.8;
          page.drawLine({
            start: { x: d.x2, y: height - d.y2 },
            end: { x: d.x2 - Math.cos(left) * ah, y: height - (d.y2 - Math.sin(left) * ah) },
            thickness: d.strokeWidth || 2,
            color: rgb(c.r, c.g, c.b),
          });
          page.drawLine({
            start: { x: d.x2, y: height - d.y2 },
            end: { x: d.x2 - Math.cos(right) * ah, y: height - (d.y2 - Math.sin(right) * ah) },
            thickness: d.strokeWidth || 2,
            color: rgb(c.r, c.g, c.b),
          });
        }
      } else if (anno.type === 'textEdit') {
        const font = await fontFor(d.fontFamily || 'Helvetica');
        const c = hexToRgb(d.color || '#12181f');
        const cover = hexToRgb(d.coverColor || '#ffffff');
        page.drawRectangle({
          x: d.x,
          y: height - d.y - d.h,
          width: d.w,
          height: d.h,
          color: rgb(cover.r, cover.g, cover.b),
          borderWidth: 0,
        });
        const size = d.fontSize || 12;
        const lines = String(d.text || '').split('\n');
        lines.forEach((line, li) => {
          page.drawText(line, {
            x: d.x + 1.5,
            y: height - d.y - size - 1 - li * (size * 1.2),
            size,
            font,
            color: rgb(c.r, c.g, c.b),
            opacity: d.opacity ?? 1,
            maxWidth: Math.max(8, d.w - 3),
          });
        });
      } else if (anno.type === 'text' || anno.type === 'sticky') {
        const font = await fontFor(d.fontFamily || 'Helvetica');
        const c = hexToRgb(d.color || '#12181f');
        if (anno.type === 'sticky') {
          page.drawRectangle({
            x: d.x,
            y: height - d.y - (d.h || 80),
            width: d.w || 140,
            height: d.h || 80,
            color: rgb(1, 0.95, 0.55),
            opacity: 0.92,
          });
        }
        const lines = String(d.text || '').split('\n');
        const size = d.fontSize || 16;
        lines.forEach((line, li) => {
          page.drawText(line, {
            x: d.x + (anno.type === 'sticky' ? 8 : 0),
            y: height - d.y - size - li * (size * 1.25) - (anno.type === 'sticky' ? 8 : 0),
            size,
            font,
            color: rgb(c.r, c.g, c.b),
            opacity: d.opacity ?? 1,
            maxWidth: (d.w || 400) - (anno.type === 'sticky' ? 16 : 0),
          });
        });
      } else if (anno.type === 'image' || anno.type === 'signature' || anno.type === 'stamp') {
        if (!d.src) continue;
        try {
          const img = await embedImageData(doc, d.src);
          page.drawImage(img, {
            x: d.x,
            y: height - d.y - d.h,
            width: d.w,
            height: d.h,
            opacity: d.opacity ?? 1,
          });
        } catch {
          /* skip broken image */
        }
      }
    }
  }
  return doc.save({ useObjectStreams: true });
}

export async function createPdfFromHtml(html, fileName = 'from-html.pdf') {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { width: 794px; font-family: Outfit, Helvetica, Arial, sans-serif; color: #12181f; }
    img { max-width: 100%; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  await new Promise((r) => setTimeout(r, 80));

  const body = doc.body;
  const totalHeight = Math.max(body.scrollHeight, 1123);
  const pageH = 1123;
  const pageW = 794;
  const pages = Math.ceil(totalHeight / pageH);
  const pdf = await PDFDocument.create();

  for (let i = 0; i < pages; i++) {
    const canvas = document.createElement('canvas');
    const scale = 2;
    canvas.width = pageW * scale;
    canvas.height = pageH * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageW, pageH);

    // Draw HTML via foreignObject SVG snapshot
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}">
        <foreignObject width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${pageW}px;height:${pageH}px;overflow:hidden;">
            <div style="transform:translateY(-${i * pageH}px);">${body.innerHTML}</div>
          </div>
        </foreignObject>
      </svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
    const png = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
    const bytes = new Uint8Array(await png.arrayBuffer());
    const embedded = await pdf.embedPng(bytes);
    const page = pdf.addPage(PageSizes.A4);
    page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  }

  document.body.removeChild(iframe);
  const bytes = await pdf.save();
  await loadPdfFromBytes(bytes, fileName);
  return bytes;
}

export async function createBlankPdf(fileName = 'blank.pdf') {
  const pdf = await PDFDocument.create();
  pdf.addPage(PageSizes.A4);
  const bytes = await pdf.save();
  await loadPdfFromBytes(bytes, fileName);
  return bytes;
}

export function downloadBytes(bytes, name, mime = 'application/pdf') {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function pageCssSize(pageNum) {
  const s = state.pageSizes[pageNum - 1] || { width: 595, height: 842 };
  return {
    width: s.width * state.scale,
    height: s.height * state.scale,
  };
}

export function cssToPdfPoint(pageNum, x, y) {
  const s = state.pageSizes[pageNum - 1] || { width: 595, height: 842 };
  return {
    x: x / state.scale,
    y: y / state.scale,
    pageWidth: s.width,
    pageHeight: s.height,
  };
}
