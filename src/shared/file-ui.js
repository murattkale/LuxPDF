import { icons } from '../ui/icons.js';
import { formatBytes } from './format.js';

export function toolPageShell({ title, subtitle, backHref = '#/', body }) {
  return `
  <div class="tool-page">
    <header class="tool-topbar">
      <a class="brand-link" href="${backHref}">
        <span class="brand-mark">${icons.logo}</span>
        <span>LuxTools</span>
      </a>
      <div class="tool-topbar-meta">
        <strong>${title}</strong>
        <span>${subtitle || ''}</span>
      </div>
      <a class="btn btn-ghost" href="${backHref}">← Katalog</a>
    </header>
    <main class="tool-main">${body}</main>
  </div>`;
}

export function dropzoneHTML({
  id = 'tool-drop',
  title = 'Dosyaları sürükleyin',
  hint = 'veya bilgisayarınızdan seçin',
  multiple = false,
  accept = 'application/pdf,.pdf',
}) {
  return `
  <div class="dropzone tool-drop" id="${id}">
    <div>
      <div class="dropzone-icon">${icons.upload}</div>
      <h2>${title}</h2>
      <p>${hint}</p>
      <div class="landing-actions">
        <button class="btn btn-primary" type="button" data-pick>${icons.upload} Dosya Seç</button>
      </div>
    </div>
    <input type="file" hidden ${multiple ? 'multiple' : ''} accept="${accept}" data-input />
  </div>`;
}

export function bindDropzone(root, { onFiles, acceptCheck } = {}) {
  const dz = root.querySelector('.tool-drop, .dropzone');
  if (!dz) return () => {};
  const input = dz.querySelector('[data-input]');
  const pick = dz.querySelector('[data-pick]');

  const handle = (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    const filtered = acceptCheck ? files.filter(acceptCheck) : files;
    if (!filtered.length) return;
    onFiles?.(filtered);
  };

  const onDragOver = (e) => { e.preventDefault(); dz.classList.add('is-active'); };
  const onDragLeave = () => dz.classList.remove('is-active');
  const onDrop = (e) => {
    e.preventDefault();
    dz.classList.remove('is-active');
    handle(e.dataTransfer.files);
  };
  const onPick = () => input?.click();
  const onChange = () => {
    handle(input.files);
    input.value = '';
  };

  dz.addEventListener('dragover', onDragOver);
  dz.addEventListener('dragleave', onDragLeave);
  dz.addEventListener('drop', onDrop);
  pick?.addEventListener('click', onPick);
  input?.addEventListener('change', onChange);

  return () => {
    dz.removeEventListener('dragover', onDragOver);
    dz.removeEventListener('dragleave', onDragLeave);
    dz.removeEventListener('drop', onDrop);
    pick?.removeEventListener('click', onPick);
    input?.removeEventListener('change', onChange);
  };
}

export function fileListHTML(files, { showRemove = true } = {}) {
  if (!files?.length) return '<p class="tool-empty">Henüz dosya yok.</p>';
  return `
  <ul class="file-list">
    ${files.map((f, i) => `
      <li>
        <div>
          <strong>${escapeHtml(f.name)}</strong>
          <span>${formatBytes(f.size)}${f.meta ? ` · ${escapeHtml(f.meta)}` : ''}</span>
        </div>
        ${showRemove ? `<button type="button" class="chip" data-remove="${i}">Kaldır</button>` : ''}
      </li>`).join('')}
  </ul>`;
}

export function resultCardHTML({ before, after, savings, note }) {
  return `
  <div class="result-card">
    <div class="result-grid">
      <div><span>Önce</span><strong>${before}</strong></div>
      <div><span>Sonra</span><strong>${after}</strong></div>
      <div><span>Kazanç</span><strong>${savings}</strong></div>
    </div>
    ${note ? `<p>${note}</p>` : ''}
  </div>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
