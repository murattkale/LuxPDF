import { toast, withLoading } from '../../ui/toast.js';
import { toolPageShell, dropzoneHTML, bindDropzone, fileListHTML, resultCardHTML } from '../../shared/file-ui.js';
import { formatBytes, stemName, downloadBytes, readFileBytes } from '../../shared/format.js';
import { pdfToZip, countPdfPages } from '../../core/tool-ops.js';

export async function mount(root) {
  let file = null;
  let result = null;

  const render = () => {
    root.innerHTML = toolPageShell({
      title: 'PDF → JPG',
      subtitle: 'Sayfaları görsele çevir',
      body: `
        ${dropzoneHTML({ title: 'PDF sürükleyin', hint: 'Her sayfa ayrı JPG olarak ZIP’e konur' })}
        <section class="tool-panel">
          <div class="field">
            <label>Kalite</label>
            <select id="quality">
              <option value="0.8">İyi</option>
              <option value="0.92" selected>Yüksek</option>
              <option value="0.98">Maksimum</option>
            </select>
          </div>
          <div id="files">${fileListHTML(file ? [file] : [])}</div>
          <div class="tool-actions">
            <button class="btn btn-primary" id="run" type="button" ${file ? '' : 'disabled'}>Dönüştür & İndir ZIP</button>
          </div>
          <div id="result"></div>
        </section>
      `,
    });

    bindDropzone(root, {
      acceptCheck: (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name),
      onFiles: async (files) => {
        const f = files[0];
        try {
          const bytes = await readFileBytes(f);
          const pages = await countPdfPages(bytes);
          file = { name: f.name, size: f.size, bytes, meta: `${pages} sayfa` };
          result = null;
          render();
          toast(`${f.name} yüklendi`);
        } catch (err) {
          toast(err.message || 'PDF okunamadı');
        }
      },
    });

    root.querySelector('#files')?.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove]')) {
        file = null;
        result = null;
        render();
      }
    });

    root.querySelector('#run')?.addEventListener('click', withLoading(async () => {
      if (!file) return;
      const quality = Number(root.querySelector('#quality').value);
      const base = stemName(file.name);
      const zip = await pdfToZip(file.bytes, base, { scale: 2, quality });
      result = { bytes: zip, name: `${base}-pages.zip`, size: zip.byteLength };
      root.querySelector('#result').innerHTML = resultCardHTML({
        before: formatBytes(file.size),
        after: formatBytes(zip.byteLength),
        savings: file.meta || '',
        note: 'ZIP içinde her sayfa ayrı JPG dosyası olarak bulunur.',
      });
      downloadBytes(zip, result.name, 'application/zip');
      toast('ZIP indirildi');
    }));
  };

  render();
  return () => { root.innerHTML = ''; };
}
