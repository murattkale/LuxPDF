import { toast, withLoading } from '../../ui/toast.js';
import { toolPageShell, dropzoneHTML, bindDropzone, fileListHTML } from '../../shared/file-ui.js';
import { formatBytes, downloadBytes } from '../../shared/format.js';
import { imagesToPdf } from '../../core/tool-ops.js';

const isImage = (f) => /^image\/(jpeg|jpg|png|webp)$/i.test(f.type) || /\.(jpe?g|png|webp)$/i.test(f.name);

export async function mount(root) {
  /** @type {File[]} */
  let files = [];

  const render = () => {
    root.innerHTML = toolPageShell({
      title: 'JPG → PDF',
      subtitle: 'Görselleri PDF yap',
      body: `
        ${dropzoneHTML({
          title: 'Görselleri sürükleyin',
          hint: 'JPG, PNG veya WEBP · çoklu seçim',
          multiple: true,
          accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
        })}
        <section class="tool-panel">
          <div id="files">${fileListHTML(files.map((f) => ({ name: f.name, size: f.size })))}</div>
          <div class="tool-actions">
            <button class="btn btn-primary" id="run" type="button" ${files.length ? '' : 'disabled'}>PDF Oluştur & İndir</button>
          </div>
        </section>
      `,
    });

    bindDropzone(root, {
      acceptCheck: isImage,
      onFiles: (incoming) => {
        files = files.concat(incoming.filter(isImage));
        render();
        toast(`${incoming.length} görsel eklendi`);
      },
    });

    root.querySelector('#files')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      files.splice(Number(btn.dataset.remove), 1);
      render();
    });

    root.querySelector('#run')?.addEventListener('click', withLoading(async () => {
      if (!files.length) return;
      // webp may fail in pdf-lib — convert via canvas first
      const normalized = [];
      for (const file of files) {
        if (/webp$/i.test(file.type) || /\.webp$/i.test(file.name)) {
          normalized.push(await webpToJpegFile(file));
        } else {
          normalized.push(file);
        }
      }
      const out = await imagesToPdf(normalized);
      downloadBytes(out, 'images.pdf');
      toast(`PDF hazır · ${formatBytes(out.byteLength)}`);
    }));
  };

  render();
  return () => { root.innerHTML = ''; };
}

async function webpToJpegFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.92));
    return new File([blob], file.name.replace(/\.webp$/i, '.jpg'), { type: 'image/jpeg' });
  } finally {
    URL.revokeObjectURL(url);
  }
}
