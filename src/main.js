import './styles/main.css';
import { icons } from './ui/icons.js';
import { toast, withLoading } from './ui/toast.js';
import { state, undo, redo, pushHistory, getPageAnnos } from './core/state.js';
import {
  loadPdfFromBytes,
  renderPageToCanvas,
  renderThumb,
  rotatePage,
  deletePage,
  addBlankPage,
  duplicatePage,
  mergePdfBytes,
  extractPages,
  addWatermark,
  addPageNumbers,
  createBlankPdf,
  createPdfFromHtml,
  cssToPdfPoint,
  downloadBytes,
} from './core/pdf-engine.js';
import {
  drawAnnotations,
  findAnnoAt,
  deleteSelected,
  eraseNear,
  preloadImages,
  addTextAt,
  addStickyAt,
  addImageAnno,
  commitStroke,
  commitShape,
} from './core/annotations.js';
import { exportAsHtml, exportAsPdf, parseHtmlImport } from './core/export-html.js';
import {
  getPageTextItems,
  findNativeTextAt,
  upsertTextEdit,
  findTextEditForNative,
  measureTextWidth,
} from './core/text-layer.js';

const app = document.getElementById('app');
const pageViews = new Map();
let drag = null;
let pan = null;
let rafAnno = null;

const TOOLS = [
  ['select', 'Seç', icons.select],
  ['hand', 'Gezdir', icons.hand],
  ['text', 'Metin ekle', icons.text],
  ['editText', 'Metin düzenle', icons.editText],
  ['pen', 'Kalem', icons.pen],
  ['highlight', 'Vurgula', icons.highlight],
  ['rect', 'Dikdörtgen', icons.rect],
  ['ellipse', 'Elips', icons.ellipse],
  ['line', 'Çizgi', icons.line],
  ['arrow', 'Ok', icons.arrow],
  ['sticky', 'Not', icons.sticky],
  ['image', 'Görsel', icons.image],
  ['signature', 'İmza', icons.signature],
  ['stamp', 'Damga', icons.stamp],
  ['redaction', 'Karart', icons.redaction],
  ['eraser', 'Silgi', icons.eraser],
];

function toolBtn(id, label, icon) {
  return `<button class="tool-btn" data-tool="${id}" type="button" aria-label="${label}">${icon}<span class="tooltip">${label}</span></button>`;
}

function landingHTML() {
  return `
  <section class="landing">
    <div class="landing-card">
      <div class="brand">
        <div class="brand-mark">${icons.logo}</div>
        <div>
          <h1>LuxPDF</h1>
          <p class="hero-copy">Tarayıcıda çalışan, veri tabanı gerektirmeyen premium PDF düzenleyici. Hızlı, modern ve tamamen sizin cihazınızda.</p>
        </div>
      </div>
      <div class="dropzone" id="dropzone">
        <div>
          <div class="dropzone-icon">${icons.upload}</div>
          <h2>PDF veya HTML sürükleyin</h2>
          <p>veya dosya seçerek başlayın — düzenleme, birleştirme, imza, export ve daha fazlası</p>
          <div class="landing-actions">
            <button class="btn btn-primary" id="btn-open">${icons.upload} PDF Aç</button>
            <button class="btn btn-secondary" id="btn-blank">${icons.addPage} Boş Sayfa</button>
            <button class="btn btn-secondary" id="btn-html">${icons.html} HTML İçe Aktar</button>
          </div>
        </div>
      </div>
      <div class="feature-row">
        <div class="feature"><strong>Görsel düzenleme</strong><span>Mevcut yazıyı seç-düzenle, kalem, şekil, imza, damga, karartma</span></div>
        <div class="feature"><strong>Sayfa yönetimi</strong><span>Döndür, sil, ekle, çoğalt, birleştir, ayır, filigran</span></div>
        <div class="feature"><strong>Export her yerde</strong><span>PDF ve HTML dışa aktarım, localStorage oturum kaydı</span></div>
      </div>
    </div>
    <input type="file" id="file-input" accept="application/pdf,.pdf" hidden />
    <input type="file" id="html-input" accept="text/html,.html,.htm" hidden />
  </section>`;
}

function editorHTML() {
  return `
  <div class="editor">
    <header class="toolbar">
      <div class="toolbar-brand">
        <div class="brand-mark">${icons.logo}</div>
        <span>LuxPDF</span>
      </div>
      <div class="file-meta">
        <strong id="file-name">document.pdf</strong>
        <span id="file-info">—</span>
      </div>
      <div class="sep"></div>
      <div class="tool-group" id="tools">
        ${TOOLS.map(([id, label, icon]) => toolBtn(id, label, icon)).join('')}
      </div>
      <div class="sep"></div>
      <div class="tool-group">
        ${toolBtn('undo', 'Geri al', icons.undo).replace('data-tool="undo"', 'data-action="undo"')}
        ${toolBtn('redo', 'İleri al', icons.redo).replace('data-tool="redo"', 'data-action="redo"')}
      </div>
      <div class="tool-group">
        ${toolBtn('zoomOut', 'Uzaklaştır', icons.zoomOut).replace('data-tool="zoomOut"', 'data-action="zoomOut"')}
        ${toolBtn('zoomIn', 'Yakınlaştır', icons.zoomIn).replace('data-tool="zoomIn"', 'data-action="zoomIn"')}
        ${toolBtn('fit', 'Sığdır', icons.fit).replace('data-tool="fit"', 'data-action="fit"')}
      </div>
      <div class="toolbar-spacer"></div>
      <div class="tool-group">
        ${toolBtn('pages', 'Sayfalar', icons.pages).replace('data-tool="pages"', 'data-action="toggleSidebar"')}
        ${toolBtn('settings', 'Özellikler', icons.settings).replace('data-tool="settings"', 'data-action="toggleProps"')}
      </div>
      <button class="btn btn-secondary" data-action="openMore" type="button">${icons.more} İşlemler</button>
      <button class="btn btn-primary" data-action="exportPdf" type="button">${icons.download} PDF</button>
      <input type="file" id="file-input" accept="application/pdf,.pdf" hidden />
      <input type="file" id="image-input" accept="image/*" hidden />
      <input type="file" id="merge-input" accept="application/pdf,.pdf" hidden />
      <input type="file" id="html-input" accept="text/html,.html,.htm" hidden />
    </header>
    <div class="workspace">
      <aside class="sidebar" id="sidebar">
        <div class="panel-head"><h3>Sayfalar</h3>
          <button class="chip" data-action="addPage" type="button">+</button>
        </div>
        <div class="thumbs" id="thumbs"></div>
      </aside>
      <main class="canvas-area" id="canvas-area">
        <div class="page-stack" id="page-stack"></div>
        <div class="status-bar" id="status-bar">Hazır</div>
      </main>
      <aside class="props" id="props">
        <div class="panel-head"><h3>Özellikler</h3></div>
        <div class="props-body" id="props-body"></div>
      </aside>
    </div>
  </div>`;
}

function setStatus(text) {
  const el = document.getElementById('status-bar');
  if (el) el.textContent = text;
}

function updateFileMeta() {
  const name = document.getElementById('file-name');
  const info = document.getElementById('file-info');
  if (name) name.textContent = state.fileName;
  if (info) info.textContent = `${state.pageCount} sayfa · ${Math.round(state.scale * 100)}%`;
}

function renderProps() {
  const body = document.getElementById('props-body');
  if (!body) return;
  const a = state.selectedAnno;
  if (!a) {
    body.innerHTML = `
      <div class="props-hint">Bir nesne seçin veya <strong>Metin düzenle</strong> aracıyla PDF üzerindeki yazıya tıklayın. Kısayollar: E metin düzenle, V seç, T metin ekle, P kalem, Ctrl+Z geri al.</div>
      <div class="field"><label>Renk</label><input type="color" id="prop-color" value="${state.color}"/></div>
      <div class="field"><label>Dolgu</label><input type="color" id="prop-fill" value="${(state.fillColor || '#0f766e').slice(0, 7)}"/></div>
      <div class="field"><label>Kalınlık · ${state.strokeWidth}px</label><input type="range" id="prop-width" min="1" max="40" step="0.5" value="${state.strokeWidth}"/></div>
      <div class="field"><label>Yazı boyutu · ${state.fontSize}px</label><input type="range" id="prop-font" min="8" max="72" value="${state.fontSize}"/></div>
      <div class="field"><label>Yazı tipi</label>
        <select id="prop-font-family">
          <option>Helvetica</option>
          <option>Helvetica-Bold</option>
          <option>Times</option>
          <option>Courier</option>
        </select>
      </div>
      <div class="chip-row">
        <button class="chip" data-action="rotate" type="button">Döndür</button>
        <button class="chip" data-action="addPage" type="button">Sayfa ekle</button>
        <button class="chip" data-action="dupPage" type="button">Çoğalt</button>
        <button class="chip" data-action="deletePage" type="button">Sayfa sil</button>
      </div>`;
    body.querySelector('#prop-font-family').value = state.fontFamily;
  } else {
    const d = a.data;
    body.innerHTML = `
      <div class="props-hint">${a.type === 'textEdit' ? 'PDF METİN DÜZENLEME' : a.type.toUpperCase()} · Sayfa ${a.page}</div>
      ${a.type === 'textEdit' && d.originalText ? `<div class="props-hint">Orijinal: ${escapeHtml(d.originalText)}</div>` : ''}
      ${d.color !== undefined || ['pen', 'highlight', 'rect', 'ellipse', 'line', 'arrow', 'text', 'textEdit'].includes(a.type) ? `<div class="field"><label>Renk</label><input type="color" id="anno-color" value="${(d.color || '#0f766e').slice(0, 7)}"/></div>` : ''}
      ${d.text !== undefined ? `<div class="field"><label>Metin</label><textarea id="anno-text">${d.text || ''}</textarea></div>` : ''}
      ${d.fontSize !== undefined ? `<div class="field"><label>Yazı · ${Math.round(d.fontSize)}px</label><input type="range" id="anno-font" min="6" max="96" value="${d.fontSize}"/></div>` : ''}
      ${d.w !== undefined ? `<div class="field"><label>Genişlik</label><input type="number" id="anno-w" value="${Math.round(d.w)}"/></div>` : ''}
      ${d.h !== undefined ? `<div class="field"><label>Yükseklik</label><input type="number" id="anno-h" value="${Math.round(d.h)}"/></div>` : ''}
      <div class="field"><label>Opaklık · ${Math.round((d.opacity ?? 1) * 100)}%</label><input type="range" id="anno-opacity" min="0.1" max="1" step="0.05" value="${d.opacity ?? 1}"/></div>
      ${['text', 'textEdit', 'sticky'].includes(a.type) ? `<button class="btn btn-secondary" data-action="openTextEditor" type="button">${icons.editText} Düzenle</button>` : ''}
      <button class="btn btn-danger" data-action="deleteAnno" type="button">${icons.trash} Sil</button>`;
  }
  bindPropEvents();
}

function bindPropEvents() {
  const color = document.getElementById('prop-color');
  const fill = document.getElementById('prop-fill');
  const width = document.getElementById('prop-width');
  const font = document.getElementById('prop-font');
  const fam = document.getElementById('prop-font-family');
  color?.addEventListener('input', (e) => { state.color = e.target.value; });
  fill?.addEventListener('input', (e) => { state.fillColor = e.target.value + '55'; });
  width?.addEventListener('input', (e) => { state.strokeWidth = +e.target.value; renderProps(); });
  font?.addEventListener('input', (e) => { state.fontSize = +e.target.value; renderProps(); });
  fam?.addEventListener('change', (e) => { state.fontFamily = e.target.value; });

  const a = state.selectedAnno;
  if (!a) return;
  document.getElementById('anno-color')?.addEventListener('input', (e) => {
    a.data.color = e.target.value; scheduleAnnoRedraw(a.page);
  });
  document.getElementById('anno-text')?.addEventListener('input', (e) => {
    a.data.text = e.target.value; scheduleAnnoRedraw(a.page);
  });
  document.getElementById('anno-font')?.addEventListener('input', (e) => {
    a.data.fontSize = +e.target.value; scheduleAnnoRedraw(a.page); renderProps();
  });
  document.getElementById('anno-w')?.addEventListener('change', (e) => {
    pushHistory(); a.data.w = +e.target.value; scheduleAnnoRedraw(a.page);
  });
  document.getElementById('anno-h')?.addEventListener('change', (e) => {
    pushHistory(); a.data.h = +e.target.value; scheduleAnnoRedraw(a.page);
  });
  document.getElementById('anno-opacity')?.addEventListener('input', (e) => {
    a.data.opacity = +e.target.value; scheduleAnnoRedraw(a.page); renderProps();
  });
}

function setActiveTool(tool) {
  state.tool = tool;
  document.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  const area = document.getElementById('canvas-area');
  if (area) {
    area.style.cursor = tool === 'hand' ? 'grab'
      : tool === 'select' ? 'default'
      : tool === 'editText' ? 'text'
      : 'crosshair';
  }
  document.querySelectorAll('.text-hit-layer').forEach((layer) => {
    layer.classList.toggle('is-active', tool === 'editText');
  });
  setStatus(tool === 'editText' ? 'PDF üzerindeki yazıya tıklayın' : `Araç: ${tool}`);
}

function scheduleAnnoRedraw(page) {
  if (rafAnno) cancelAnimationFrame(rafAnno);
  rafAnno = requestAnimationFrame(() => {
    const view = pageViews.get(page);
    if (!view) return;
    const { anno, wrap } = view;
    const cssW = wrap.clientWidth;
    const cssH = wrap.clientHeight;
    drawAnnotations(anno.getContext('2d'), page, cssW, cssH);
  });
}

function redrawAllAnnos() {
  for (const page of pageViews.keys()) scheduleAnnoRedraw(page);
}

async function buildPages() {
  const stack = document.getElementById('page-stack');
  const thumbs = document.getElementById('thumbs');
  stack.innerHTML = '';
  thumbs.innerHTML = '';
  pageViews.clear();
  const token = ++state.renderToken;

  for (let i = 1; i <= state.pageCount; i++) {
    if (token !== state.renderToken) return;
    const wrap = document.createElement('div');
    wrap.className = 'page-wrap';
    wrap.dataset.page = String(i);
    const render = document.createElement('canvas');
    render.className = 'page-render';
    const anno = document.createElement('canvas');
    anno.className = 'anno-layer';
    const textLayer = document.createElement('div');
    textLayer.className = 'text-hit-layer' + (state.tool === 'editText' ? ' is-active' : '');
    wrap.append(render, anno, textLayer);
    stack.appendChild(wrap);

    const size = await renderPageToCanvas(i, render, state.scale);
    if (token !== state.renderToken) return;
    anno.width = Math.floor(size.cssWidth * state.dpr);
    anno.height = Math.floor(size.cssHeight * state.dpr);
    anno.style.width = `${size.cssWidth}px`;
    anno.style.height = `${size.cssHeight}px`;
    pageViews.set(i, { wrap, render, anno, textLayer });
    await preloadImages(i);
    drawAnnotations(anno.getContext('2d'), i, size.cssWidth, size.cssHeight);
    bindPageEvents(i, anno);
    await mountTextHits(i, textLayer);

    const thumb = document.createElement('button');
    thumb.className = 'thumb' + (i === state.currentPage ? ' active' : '');
    thumb.type = 'button';
    thumb.dataset.page = String(i);
    const tc = document.createElement('canvas');
    thumb.appendChild(tc);
    const label = document.createElement('span');
    label.className = 'thumb-label';
    label.textContent = String(i);
    thumb.appendChild(label);
    thumbs.appendChild(thumb);
    thumb.addEventListener('click', () => scrollToPage(i));
    renderThumb(i, tc).catch(() => {});
  }
  updateFileMeta();
  setStatus(`${state.pageCount} sayfa yüklendi`);
  saveSession();
}

function scrollToPage(page) {
  state.currentPage = page;
  document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('active', +t.dataset.page === page));
  pageViews.get(page)?.wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  updateFileMeta();
}

function pointerPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function bindPageEvents(page, canvas) {
  canvas.onpointerdown = (e) => onPointerDown(page, canvas, e);
  canvas.onpointermove = (e) => onPointerMove(page, canvas, e);
  canvas.onpointerup = (e) => onPointerUp(page, canvas, e);
  canvas.onpointerleave = (e) => {
    if (state.drawing) onPointerUp(page, canvas, e);
  };
  canvas.ondblclick = async (e) => {
    const { x, y } = pointerPos(e, canvas);
    const anno = findAnnoAt(page, x, y);
    if (anno && (anno.type === 'text' || anno.type === 'sticky' || anno.type === 'textEdit')) {
      openTextEditModal({
        mode: 'anno',
        anno,
        page,
      });
      return;
    }
    const items = await getPageTextItems(page);
    const native = findNativeTextAt(items, x, y);
    if (native) openTextEditModal({ mode: 'native', native, page });
  };
}

async function mountTextHits(page, layer) {
  layer.innerHTML = '';
  try {
    const items = await getPageTextItems(page);
    state.textItemsByPage.set(page, items);
    const s = state.scale;
    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'text-hit';
      btn.dataset.nativeId = item.id;
      btn.title = item.text;
      btn.style.left = `${item.x * s}px`;
      btn.style.top = `${item.y * s}px`;
      btn.style.width = `${Math.max(item.w * s, 8)}px`;
      btn.style.height = `${Math.max(item.h * s, 10)}px`;
      if (findTextEditForNative(page, item.id)) btn.classList.add('is-edited');
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTextEditModal({ mode: 'native', native: item, page });
      });
      layer.appendChild(btn);
    }
  } catch {
    /* scanned PDF / no text */
  }
}

function refreshTextHitStates(page) {
  const view = pageViews.get(page);
  if (!view?.textLayer) return;
  view.textLayer.querySelectorAll('.text-hit').forEach((btn) => {
    btn.classList.toggle('is-edited', !!findTextEditForNative(page, btn.dataset.nativeId));
  });
}

function openTextEditModal({ mode, native, anno, page }) {
  const existing = mode === 'native' ? findTextEditForNative(page, native.id) : anno;
  const sourceText = existing?.data?.text ?? native?.text ?? anno?.data?.text ?? '';
  const fontSize = existing?.data?.fontSize ?? native?.fontSize ?? anno?.data?.fontSize ?? 14;
  const color = existing?.data?.color ?? anno?.data?.color ?? '#12181f';
  const fontFamily = existing?.data?.fontFamily ?? native?.fontName ?? anno?.data?.fontFamily ?? 'Helvetica';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal edit-text-modal">
      <div class="modal-head">
        <h2>${mode === 'native' ? 'PDF metnini düzenle' : 'Metni düzenle'}</h2>
        <button type="button" data-close>${icons.close}</button>
      </div>
      <div class="modal-body">
        ${mode === 'native' ? `<div class="props-hint" style="color:#5b6673;background:#f6f8fa;border:1px solid rgba(18,24,31,.08);border-radius:12px;padding:12px;margin-bottom:12px;font-size:.9rem;">Orijinal: <strong>${escapeHtml(native.text)}</strong></div>` : ''}
        <div class="field"><label style="display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6673;margin-bottom:6px;">Yeni metin</label>
          <textarea id="edit-text-value" style="width:100%;min-height:110px;border-radius:12px;border:1px solid rgba(18,24,31,.14);padding:12px;font:inherit;">${escapeHtml(sourceText)}</textarea>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:12px;">
          <div class="field"><label style="display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6673;margin-bottom:6px;">Boyut</label>
            <input id="edit-text-size" type="number" min="6" max="120" value="${Math.round(fontSize)}" style="width:100%;min-height:40px;border-radius:10px;border:1px solid rgba(18,24,31,.14);padding:8px 12px;"/>
          </div>
          <div class="field"><label style="display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6673;margin-bottom:6px;">Renk</label>
            <input id="edit-text-color" type="color" value="${color.slice(0, 7)}" style="width:100%;min-height:40px;border-radius:10px;border:1px solid rgba(18,24,31,.14);padding:4px;"/>
          </div>
          <div class="field"><label style="display:block;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;color:#5b6673;margin-bottom:6px;">Yazı tipi</label>
            <select id="edit-text-font" style="width:100%;min-height:40px;border-radius:10px;border:1px solid rgba(18,24,31,.14);padding:8px 12px;">
              <option>Helvetica</option>
              <option>Helvetica-Bold</option>
              <option>Times</option>
              <option>Courier</option>
            </select>
          </div>
        </div>
        <div class="edit-preview" id="edit-text-preview"></div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" type="button" data-close>İptal</button>
        <button class="btn btn-primary" type="button" data-save>${icons.check} Uygula</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);

  const valueEl = backdrop.querySelector('#edit-text-value');
  const sizeEl = backdrop.querySelector('#edit-text-size');
  const colorEl = backdrop.querySelector('#edit-text-color');
  const fontEl = backdrop.querySelector('#edit-text-font');
  const preview = backdrop.querySelector('#edit-text-preview');
  fontEl.value = fontFamily;
  const syncPreview = () => {
    preview.style.color = colorEl.value;
    preview.style.fontSize = `${sizeEl.value}px`;
    preview.style.fontFamily = `${fontEl.value}, Outfit, sans-serif`;
    preview.textContent = valueEl.value || ' ';
  };
  syncPreview();
  valueEl.addEventListener('input', syncPreview);
  sizeEl.addEventListener('input', syncPreview);
  colorEl.addEventListener('input', syncPreview);
  fontEl.addEventListener('change', syncPreview);
  valueEl.focus();
  valueEl.select();

  const close = () => backdrop.remove();
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') backdrop.querySelector('[data-save]').click();
  });

  backdrop.querySelector('[data-save]').onclick = () => {
    const text = valueEl.value;
    const nextSize = +sizeEl.value || fontSize;
    const nextColor = colorEl.value;
    const nextFont = fontEl.value;

    if (mode === 'native') {
      const width = Math.max(
        native.w,
        measureTextWidth(text, nextSize, nextFont) + 4,
      );
      upsertTextEdit(native, text, {
        fontSize: nextSize,
        color: nextColor,
        fontFamily: nextFont,
        w: width,
      });
      scheduleAnnoRedraw(page);
      refreshTextHitStates(page);
      setActiveTool('select');
      renderProps();
      saveSession();
      toast('Metin güncellendi');
    } else if (anno) {
      pushHistory();
      anno.data.text = text;
      anno.data.fontSize = nextSize;
      anno.data.color = nextColor;
      anno.data.fontFamily = nextFont;
      if (anno.type === 'textEdit') {
        anno.data.w = Math.max(anno.data.w, measureTextWidth(text, nextSize, nextFont) + 4);
      }
      state.selectedAnno = anno;
      scheduleAnnoRedraw(page);
      refreshTextHitStates(page);
      renderProps();
      saveSession();
      toast('Metin güncellendi');
    }
    close();
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function onPointerDown(page, canvas, e) {
  canvas.setPointerCapture(e.pointerId);
  const { x, y } = pointerPos(e, canvas);
  state.currentPage = page;

  if (state.tool === 'hand') {
    pan = { x: e.clientX, y: e.clientY, sl: canvasArea().scrollLeft, st: canvasArea().scrollTop };
    canvas.style.cursor = 'grabbing';
    return;
  }

  if (state.tool === 'select') {
    const hit = findAnnoAt(page, x, y);
    state.selectedAnno = hit;
    renderProps();
    redrawAllAnnos();
    if (hit) {
      const pt = cssToPdfPoint(page, x, y);
      pushHistory();
      drag = {
        mode: 'move',
        page,
        id: hit.id,
        ox: pt.x,
        oy: pt.y,
        snapshot: structuredClone(hit.data),
        moved: false,
      };
    }
    return;
  }

  if (state.tool === 'editText') {
    (async () => {
      const hitAnno = findAnnoAt(page, x, y);
      if (hitAnno && (hitAnno.type === 'textEdit' || hitAnno.type === 'text' || hitAnno.type === 'sticky')) {
        openTextEditModal({ mode: 'anno', anno: hitAnno, page });
        return;
      }
      const items = await getPageTextItems(page);
      const native = findNativeTextAt(items, x, y);
      if (native) openTextEditModal({ mode: 'native', native, page });
      else toast('Düzenlenecek yazı bulunamadı — metnin üzerine tıklayın');
    })();
    return;
  }

  if (state.tool === 'eraser') {
    state.drawing = true;
    if (eraseNear(page, x, y)) scheduleAnnoRedraw(page);
    return;
  }

  if (state.tool === 'text') {
    addTextAt(page, x, y);
    setActiveTool('select');
    scheduleAnnoRedraw(page);
    renderProps();
    return;
  }

  if (state.tool === 'sticky') {
    addStickyAt(page, x, y);
    setActiveTool('select');
    scheduleAnnoRedraw(page);
    renderProps();
    return;
  }

  if (state.tool === 'image' || state.tool === 'stamp') {
    document.getElementById('image-input').click();
    state._pendingImagePoint = { page, x, y, type: state.tool === 'stamp' ? 'stamp' : 'image' };
    return;
  }

  if (state.tool === 'signature') {
    openSignatureModal(page, x, y);
    return;
  }

  if (state.tool === 'pen' || state.tool === 'highlight') {
    state.drawing = true;
    const pt = cssToPdfPoint(page, x, y);
    state.currentStroke = {
      type: state.tool,
      page,
      color: state.tool === 'highlight' ? state.highlightColor : state.color,
      width: state.tool === 'highlight' ? Math.max(12, state.strokeWidth * 4) : state.strokeWidth,
      opacity: 1,
      points: [{ x: pt.x, y: pt.y }],
    };
    return;
  }

  if (['rect', 'ellipse', 'line', 'arrow', 'redaction'].includes(state.tool)) {
    state.drawing = true;
    const pt = cssToPdfPoint(page, x, y);
    if (state.tool === 'line' || state.tool === 'arrow') {
      state.tempShape = {
        type: state.tool,
        page,
        x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y,
        color: state.color,
        strokeWidth: state.strokeWidth,
      };
    } else {
      state.tempShape = {
        type: state.tool,
        page,
        x: pt.x, y: pt.y, w: 0, h: 0,
        color: state.tool === 'redaction' ? '#000000' : state.color,
        fill: state.tool === 'redaction' ? '#000000' : state.fillColor,
        strokeWidth: state.strokeWidth,
      };
    }
  }
}

function onPointerMove(page, canvas, e) {
  if (pan) {
    const area = canvasArea();
    area.scrollLeft = pan.sl - (e.clientX - pan.x);
    area.scrollTop = pan.st - (e.clientY - pan.y);
    return;
  }

  const { x, y } = pointerPos(e, canvas);

  if (state.tool === 'eraser' && state.drawing) {
    if (eraseNear(page, x, y)) scheduleAnnoRedraw(page);
    return;
  }

  if (drag?.mode === 'move') {
    const anno = getPageAnnos(page).find((a) => a.id === drag.id);
    if (!anno) return;
    const pt = cssToPdfPoint(page, x, y);
    const dx = pt.x - drag.ox;
    const dy = pt.y - drag.oy;
    const s = drag.snapshot;
    drag.moved = true;
    if (s.x !== undefined) { anno.data.x = s.x + dx; anno.data.y = s.y + dy; }
    if (s.x1 !== undefined) {
      anno.data.x1 = s.x1 + dx; anno.data.y1 = s.y1 + dy;
      anno.data.x2 = s.x2 + dx; anno.data.y2 = s.y2 + dy;
    }
    if (s.points) {
      anno.data.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
    scheduleAnnoRedraw(page);
    return;
  }

  if (!state.drawing) return;
  const pt = cssToPdfPoint(page, x, y);

  if (state.currentStroke) {
    const last = state.currentStroke.points.at(-1);
    if (!last || Math.hypot(last.x - pt.x, last.y - pt.y) > 0.6) {
      state.currentStroke.points.push({ x: pt.x, y: pt.y });
      scheduleAnnoRedraw(page);
    }
    return;
  }

  if (state.tempShape) {
    if (state.tempShape.type === 'line' || state.tempShape.type === 'arrow') {
      state.tempShape.x2 = pt.x;
      state.tempShape.y2 = pt.y;
    } else {
      state.tempShape.w = pt.x - state.tempShape.x;
      state.tempShape.h = pt.y - state.tempShape.y;
    }
    scheduleAnnoRedraw(page);
  }
}

function onPointerUp(page, canvas, e) {
  if (pan) {
    pan = null;
    canvas.style.cursor = 'grab';
    return;
  }
  if (drag) {
    if (drag.mode === 'move' && !drag.moved) {
      // click-only select: drop empty history entry
      state.history.pop();
    }
    drag = null;
    saveSession();
    return;
  }
  if (!state.drawing) return;
  state.drawing = false;

  if (state.currentStroke) {
    commitStroke();
    scheduleAnnoRedraw(page);
    saveSession();
    return;
  }
  if (state.tempShape) {
    commitShape();
    scheduleAnnoRedraw(page);
    renderProps();
    saveSession();
  }
}

function canvasArea() {
  return document.getElementById('canvas-area');
}

async function openFile(file) {
  const buf = await file.arrayBuffer();
  await loadPdfFromBytes(new Uint8Array(buf), file.name);
  showEditor();
  await buildPages();
  toast(`${file.name} yüklendi`);
}

async function openHtmlFile(file) {
  const parsed = await parseHtmlImport(file);
  if (parsed?.isHtml || parsed?.html) {
    await createPdfFromHtml(parsed.html || parsed, file.name.replace(/\.(html|htm)$/i, '.pdf'));
  } else if (parsed instanceof Uint8Array) {
    await loadPdfFromBytes(parsed, file.name.replace(/\.(html|htm)$/i, '.pdf'));
  } else {
    throw new Error('HTML içinde PDF verisi bulunamadı');
  }
  showEditor();
  await buildPages();
  toast('HTML içe aktarıldı');
}

function showLanding() {
  app.innerHTML = landingHTML();
  const dz = document.getElementById('dropzone');
  const fi = document.getElementById('file-input');
  const hi = document.getElementById('html-input');

  const onFiles = withLoading(async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (/\.html?$/i.test(file.name) || file.type.includes('html')) await openHtmlFile(file);
    else await openFile(file);
  });

  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('is-active'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('is-active'));
  dz.addEventListener('drop', (e) => {
    e.preventDefault();
    dz.classList.remove('is-active');
    onFiles(e.dataTransfer.files);
  });
  document.getElementById('btn-open').onclick = () => fi.click();
  document.getElementById('btn-html').onclick = () => hi.click();
  document.getElementById('btn-blank').onclick = withLoading(async () => {
    await createBlankPdf('yeni.pdf');
    showEditor();
    await buildPages();
  });
  fi.onchange = () => onFiles(fi.files);
  hi.onchange = () => onFiles(hi.files);
}

function showEditor() {
  app.innerHTML = editorHTML();
  setActiveTool(state.tool);
  renderProps();
  updateFileMeta();
  bindEditorChrome();
}

function bindEditorChrome() {
  document.getElementById('tools')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tool]');
    if (!btn) return;
    setActiveTool(btn.dataset.tool);
  });

  app.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    try {
      if (action === 'undo') { undo(); redrawAllAnnos(); renderProps(); }
      if (action === 'redo') { redo(); redrawAllAnnos(); renderProps(); }
      if (action === 'zoomIn') { state.scale = Math.min(3, state.scale + 0.15); await rebuild(); }
      if (action === 'zoomOut') { state.scale = Math.max(0.4, state.scale - 0.15); await rebuild(); }
      if (action === 'fit') { fitWidth(); await rebuild(); }
      if (action === 'toggleSidebar') document.getElementById('sidebar')?.classList.toggle('open-mobile');
      if (action === 'toggleProps') document.getElementById('props')?.classList.toggle('open-mobile');
      if (action === 'exportPdf') await withLoading(exportAsPdf)();
      if (action === 'openMore') openMoreModal();
      if (action === 'addPage') await withLoading(async () => { await addBlankPage(state.currentPage - 1); await rebuild(); })();
      if (action === 'dupPage') await withLoading(async () => { await duplicatePage(state.currentPage - 1); await rebuild(); })();
      if (action === 'deletePage') await withLoading(async () => { await deletePage(state.currentPage - 1); await rebuild(); })();
      if (action === 'rotate') await withLoading(async () => { await rotatePage(state.currentPage - 1, 90); await rebuild(); })();
      if (action === 'deleteAnno') {
        const page = state.selectedAnno?.page;
        deleteSelected();
        redrawAllAnnos();
        if (page) refreshTextHitStates(page);
        renderProps();
        saveSession();
      }
      if (action === 'openTextEditor' && state.selectedAnno) {
        openTextEditModal({ mode: 'anno', anno: state.selectedAnno, page: state.selectedAnno.page });
      }
    } catch (err) {
      toast(err.message || 'İşlem başarısız');
    }
  });

  document.getElementById('image-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !state._pendingImagePoint) return;
    const src = await readAsDataURL(file);
    const img = await loadImage(src);
    const { page, x, y, type } = state._pendingImagePoint;
    await addImageAnno(page, x, y, src, img.width, img.height, type);
    state._pendingImagePoint = null;
    setActiveTool('select');
    scheduleAnnoRedraw(page);
    renderProps();
    saveSession();
  };

  document.getElementById('file-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await withLoading(openFile)(file);
  };
  document.getElementById('merge-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await withLoading(async () => {
      await mergePdfBytes(new Uint8Array(await file.arrayBuffer()));
      await rebuild();
      toast('PDF birleştirildi');
    })();
  };
  document.getElementById('html-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (file) await withLoading(openHtmlFile)(file);
  };

  const area = canvasArea();
  area.addEventListener('scroll', () => {
    const mid = area.scrollTop + area.clientHeight / 3;
    for (const [page, view] of pageViews) {
      const top = view.wrap.offsetTop;
      const bottom = top + view.wrap.offsetHeight;
      if (mid >= top && mid <= bottom) {
        if (state.currentPage !== page) {
          state.currentPage = page;
          document.querySelectorAll('.thumb').forEach((t) => t.classList.toggle('active', +t.dataset.page === page));
          updateFileMeta();
        }
        break;
      }
    }
  });
}

async function rebuild() {
  await buildPages();
  renderProps();
}

function fitWidth() {
  const area = canvasArea();
  const size = state.pageSizes[state.currentPage - 1];
  if (!size || !area) return;
  state.scale = Math.max(0.4, Math.min(2.5, (area.clientWidth - 48) / size.width));
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function openSignatureModal(page, cssX, cssY) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>İmza çiz</h2><button type="button" data-close>${icons.close}</button></div>
      <div class="modal-body"><canvas class="sig-pad" id="sig-pad"></canvas></div>
      <div class="modal-foot">
        <button class="btn btn-ghost" type="button" data-clear>Temizle</button>
        <button class="btn btn-secondary" type="button" data-close>İptal</button>
        <button class="btn btn-primary" type="button" data-save>Ekle</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const canvas = backdrop.querySelector('#sig-pad');
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * state.dpr;
  canvas.height = 220 * state.dpr;
  canvas.style.height = '220px';
  const ctx = canvas.getContext('2d');
  ctx.scale(state.dpr, state.dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#12181f';
  ctx.lineWidth = 2.2;
  let drawing = false;
  canvas.onpointerdown = (e) => {
    drawing = true;
    const r = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onpointermove = (e) => {
    if (!drawing) return;
    const r = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  };
  canvas.onpointerup = () => { drawing = false; };
  backdrop.querySelector('[data-clear]').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => backdrop.remove());
  backdrop.querySelector('[data-save]').onclick = async () => {
    const src = canvas.toDataURL('image/png');
    await addImageAnno(page, cssX, cssY, src, 220, 80, 'signature');
    backdrop.remove();
    setActiveTool('select');
    scheduleAnnoRedraw(page);
    renderProps();
    saveSession();
  };
}

function openMoreModal() {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal wide">
      <div class="modal-head"><h2>Belge işlemleri</h2><button type="button" data-close>${icons.close}</button></div>
      <div class="modal-body" style="display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))">
        <button class="btn btn-secondary" data-act="open">${icons.upload} PDF aç</button>
        <button class="btn btn-secondary" data-act="merge">${icons.merge} PDF birleştir</button>
        <button class="btn btn-secondary" data-act="split">${icons.split} Sayfaları ayır</button>
        <button class="btn btn-secondary" data-act="extract">${icons.pages} Sayfa çıkar</button>
        <button class="btn btn-secondary" data-act="watermark">${icons.watermark} Filigran</button>
        <button class="btn btn-secondary" data-act="numbers">${icons.number} Sayfa no</button>
        <button class="btn btn-secondary" data-act="htmlIn">${icons.html} HTML içe aktar</button>
        <button class="btn btn-secondary" data-act="htmlOut">${icons.html} HTML export</button>
        <button class="btn btn-secondary" data-act="pdfOut">${icons.download} PDF export</button>
        <button class="btn btn-secondary" data-act="blank">${icons.addPage} Boş belge</button>
      </div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close type="button">Kapat</button></div>
    </div>`;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelectorAll('[data-close]').forEach((b) => b.onclick = close);
  backdrop.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    close();
    try {
      if (act === 'open') document.getElementById('file-input').click();
      if (act === 'merge') document.getElementById('merge-input').click();
      if (act === 'htmlIn') document.getElementById('html-input').click();
      if (act === 'htmlOut') await exportAsHtml();
      if (act === 'pdfOut') await withLoading(exportAsPdf)();
      if (act === 'blank') await withLoading(async () => { await createBlankPdf(); await rebuild(); })();
      if (act === 'watermark') {
        const text = prompt('Filigran metni', 'LUXPDF');
        if (text) await withLoading(async () => { await addWatermark(text); await rebuild(); })();
      }
      if (act === 'numbers') await withLoading(async () => { await addPageNumbers(); await rebuild(); })();
      if (act === 'split' || act === 'extract') {
        const raw = prompt('Sayfa numaraları (örn: 1,2,5-7)', `1-${state.pageCount}`);
        if (!raw) return;
        const indices = parsePageRanges(raw, state.pageCount);
        const bytes = await extractPages(indices);
        downloadBytes(bytes, state.fileName.replace(/\.pdf$/i, '') + '-extract.pdf');
        toast('Sayfalar dışa aktarıldı');
      }
    } catch (err) {
      toast(err.message || 'Hata');
    }
  });
}

function parsePageRanges(input, max) {
  const set = new Set();
  for (const part of input.split(',')) {
    const p = part.trim();
    if (!p) continue;
    if (p.includes('-')) {
      const [a, b] = p.split('-').map((n) => parseInt(n, 10));
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i - 1);
    } else {
      const n = parseInt(p, 10);
      if (n >= 1 && n <= max) set.add(n - 1);
    }
  }
  return [...set].sort((a, b) => a - b);
}

function saveSession() {
  try {
    const payload = {
      fileName: state.fileName,
      scale: state.scale,
      tool: state.tool,
      color: state.color,
      strokeWidth: state.strokeWidth,
      fontSize: state.fontSize,
      annotations: [...state.annotations.entries()],
    };
    localStorage.setItem('luxpdf:prefs', JSON.stringify(payload));
  } catch { /* quota */ }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem('luxpdf:prefs');
    if (!raw) return;
    const p = JSON.parse(raw);
    if (p.scale) state.scale = p.scale;
    if (p.tool) state.tool = p.tool;
    if (p.color) state.color = p.color;
    if (p.strokeWidth) state.strokeWidth = p.strokeWidth;
    if (p.fontSize) state.fontSize = p.fontSize;
  } catch { /* ignore */ }
}

function bindGlobalKeys() {
  window.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); redrawAllAnnos(); renderProps(); }
    if (meta && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); redrawAllAnnos(); renderProps(); }
    if (meta && e.key.toLowerCase() === 's') { e.preventDefault(); withLoading(exportAsPdf)(); }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (deleteSelected()) { redrawAllAnnos(); renderProps(); }
    }
    if (e.key === 'v' || e.key === 'V') setActiveTool('select');
    if (e.key === 't' || e.key === 'T') setActiveTool('text');
    if (e.key === 'e' || e.key === 'E') setActiveTool('editText');
    if (e.key === 'p' || e.key === 'P') setActiveTool('pen');
    if (e.key === 'h' || e.key === 'H') setActiveTool('highlight');
    if (e.key === ' ') {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      setActiveTool(state.tool === 'hand' ? 'select' : 'hand');
    }
  });
}

loadPrefs();
bindGlobalKeys();
showLanding();

window.LuxPDF = {
  state,
  rebuild,
  exportAsPdf,
  async openBytes(bytes, name = 'document.pdf') {
    await loadPdfFromBytes(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), name);
    showEditor();
    await buildPages();
  },
};
