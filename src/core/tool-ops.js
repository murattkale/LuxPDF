import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

async function getPdf(bytes) {
  const task = pdfjs.getDocument({ data: bytes.slice() });
  return task.promise;
}

export async function mergePdfFiles(fileBytesList) {
  const out = await PDFDocument.create();
  for (const bytes of fileBytesList) {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return out.save({ useObjectStreams: true });
}

/**
 * Re-rasterize pages as JPEG for strong size reduction.
 * quality: 0.4–0.92, scale: render scale (1–2)
 */
export async function compressPdf(bytes, { quality = 0.72, scale = 1.4 } = {}) {
  const pdf = await getPdf(bytes);
  const out = await PDFDocument.create();
  const dpr = 1;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: scale * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    const jpgBytes = new Uint8Array(await blob.arrayBuffer());
    const image = await out.embedJpg(jpgBytes);
    const w = image.width;
    const h = image.height;
    const pdfPage = out.addPage([w, h]);
    pdfPage.drawImage(image, { x: 0, y: 0, width: w, height: h });
  }

  return out.save({ useObjectStreams: true });
}

export async function imagesToPdf(files) {
  const out = await PDFDocument.create();
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = /png$/i.test(file.type) || /\.png$/i.test(file.name);
    const image = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
    const page = out.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return out.save({ useObjectStreams: true });
}

export async function pdfToImages(bytes, { scale = 2, type = 'image/jpeg', quality = 0.92 } = {}) {
  const pdf = await getPdf(bytes);
  const images = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    images.push({ page: i, blob, ext: type.includes('png') ? 'png' : 'jpg' });
  }
  return images;
}

export async function pdfToZip(bytes, baseName = 'pages', options = {}) {
  const images = await pdfToImages(bytes, options);
  const zip = new JSZip();
  const folder = zip.folder(baseName) || zip;
  for (const img of images) {
    folder.file(`${baseName}-page-${String(img.page).padStart(2, '0')}.${img.ext}`, img.blob);
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

export async function countPdfPages(bytes) {
  const pdf = await getPdf(bytes);
  return pdf.numPages;
}
