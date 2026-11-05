import { toast, withLoading } from '../../ui/toast.js';
import { toolPageShell, dropzoneHTML, bindDropzone, fileListHTML, resultCardHTML } from '../../shared/file-ui.js';
import { formatBytes, stemName, downloadBytes, readFileBytes } from '../../shared/format.js';
import { compressPdf, countPdfPages } from '../../core/tool-ops.js';

export async function mount(root) {
  let file = null;
  let result = null;

  const render = () => {
    root.innerHTML = toolPageShell({
      title: 'PDF Sıkıştır',
      subtitle: 'Boyutu küçült · cihazında işle',
      body: `
        ${dropzoneHTML({ title: 'PDF sürükleyin', hint: 'Sıkıştırılacak belgeyi seçin' })}
        <section class="tool-panel">
          <div class="field">
            <label>Kalite</label>
            <select id="quality">
              <option value="0.55">Güçlü sıkıştırma (daha küçük)</option>
              <option value="0.72" selected>Dengeli (önerilen)</option>
              <option value="0.85">Yüksek kalite</option>
            </select>
          </div>
          <div id="files">${fileListHTML(file ? [file] : [])}</div>
          <div class="tool-actions">
            <button class="btn btn-primary" id="run" type="button" ${file ? '' : 'disabled'}>Sıkıştır</button>
            <button class="btn btn-secondary" id="download" type="button" ${result ? '' : 'disabled'}>İndir</button>
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
      const out = await compressPdf(file.bytes, { quality, scale: quality < 0.6 ? 1.2 : 1.4 });
      const saved = Math.max(0, file.size - out.byteLength);
      const pct = file.size ? Math.round((saved / file.size) * 100) : 0;
      result = {
        bytes: out,
        name: `${stemName(file.name)}-compressed.pdf`,
        size: out.byteLength,
        before: formatBytes(file.size),
        after: formatBytes(out.byteLength),
        savings: pct > 0 ? `%${pct} · ${formatBytes(saved)}` : 'Boyut benzer kaldı',
      };
      root.querySelector('#result').innerHTML = resultCardHTML(result);
      root.querySelector('#download').disabled = false;
      toast('Sıkıştırma tamam');
    }));

    root.querySelector('#download')?.addEventListener('click', () => {
      if (!result) return;
      downloadBytes(result.bytes, result.name);
    });
  };

  render();
  return () => { root.innerHTML = ''; };
}
