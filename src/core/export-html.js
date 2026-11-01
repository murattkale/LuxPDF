import { state } from './state.js';
import { exportAnnotationsHtml } from './annotations.js';
import { buildAnnotatedPdf, downloadBytes } from './pdf-engine.js';

export async function exportAsHtml() {
  const annos = exportAnnotationsHtml();
  const pdfBase64 = await bytesToBase64(state.pdfBytes);
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(state.fileName)} — LuxPDF Export</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: Outfit, Helvetica, Arial, sans-serif; background: #eef1f4; color: #12181f; }
  header { padding: 24px; background: #12181f; color: #fff; }
  header h1 { margin: 0 0 6px; font-size: 1.4rem; letter-spacing: -0.03em; }
  header p { margin: 0; opacity: .7; font-size: .9rem; }
  main { max-width: 920px; margin: 24px auto; padding: 0 16px 48px; }
  .meta { background: #fff; border-radius: 14px; padding: 16px 18px; margin-bottom: 16px; border: 1px solid rgba(18,24,31,.08); }
  .anno { background: #fff; border: 1px solid rgba(18,24,31,.08); border-radius: 12px; padding: 12px 14px; margin: 8px 0; }
  .anno strong { display:inline-block; min-width: 88px; color: #0f766e; }
  pre { white-space: pre-wrap; word-break: break-word; background: #0f1419; color: #e8eef5; padding: 14px; border-radius: 12px; overflow: auto; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>LuxPDF HTML Export</h1>
  <p>${escapeHtml(state.fileName)} · ${state.pageCount} sayfa · ${annos.length} ek açıklama</p>
</header>
<main>
  <div class="meta">
    <p>Bu dosya PDF içeriğinin metadata + annotation dışa aktarımıdır. Orijinal PDF base64 olarak gömülüdür; LuxPDF ile yeniden açabilirsiniz.</p>
  </div>
  ${annos.map((a) => `<div class="anno"><strong>${a.type}</strong> Sayfa ${a.page}<pre>${escapeHtml(JSON.stringify(a.data, null, 2))}</pre></div>`).join('') || '<p>Açıklama yok.</p>'}
  <h2>Gömülü PDF</h2>
  <pre id="pdf-data">${pdfBase64}</pre>
</main>
</body>
</html>`;
  downloadBytes(new TextEncoder().encode(html), state.fileName.replace(/\.pdf$/i, '') + '.html', 'text/html');
}

export async function exportAsPdf() {
  const bytes = await buildAnnotatedPdf();
  downloadBytes(bytes, state.fileName.replace(/\.pdf$/i, '') + '-edited.pdf');
  return bytes;
}

export async function parseHtmlImport(file) {
  const text = await file.text();
  const match = text.match(/<pre id="pdf-data">([\s\S]*?)<\/pre>/);
  if (match) {
    const b64 = match[1].trim();
    return base64ToBytes(b64);
  }
  // Treat as rich HTML document → convert via engine
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return { html: bodyMatch ? bodyMatch[1] : text, isHtml: true };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
