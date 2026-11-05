import { toast, withLoading } from '../../ui/toast.js';
import { toolPageShell, dropzoneHTML, bindDropzone, fileListHTML } from '../../shared/file-ui.js';
import { formatBytes, downloadBytes, readFileBytes } from '../../shared/format.js';
import { mergePdfFiles, countPdfPages } from '../../core/tool-ops.js';

export async function mount(root) {
  /** @type {{name:string,size:number,bytes:Uint8Array,meta?:string}[]} */
  let files = [];

  const render = () => {
    root.innerHTML = toolPageShell({
      title: 'PDF Birleştir',
      subtitle: 'Sıralı birleştir · sürükle bırak',
      body: `
        ${dropzoneHTML({
          title: 'PDF’leri sürükleyin',
          hint: 'Birden fazla dosya seçebilirsiniz',
          multiple: true,
        })}
        <section class="tool-panel">
          <div id="files">${fileListHTML(files)}</div>
          <div class="tool-actions">
            <button class="btn btn-secondary" id="up" type="button" ${files.length > 1 ? '' : 'disabled'}>Yukarı</button>
            <button class="btn btn-secondary" id="down" type="button" ${files.length > 1 ? '' : 'disabled'}>Aşağı</button>
            <button class="btn btn-primary" id="run" type="button" ${files.length > 1 ? '' : 'disabled'}>Birleştir & İndir</button>
          </div>
          <p class="tool-hint">Listede üstteki dosya PDF’in başında yer alır. Sırayı yukarı/aşağı ile değiştirebilirsiniz.</p>
        </section>
      `,
    });

    let selected = 0;

    bindDropzone(root, {
      acceptCheck: (f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name),
      onFiles: async (incoming) => {
        try {
          for (const f of incoming) {
            const bytes = await readFileBytes(f);
            const pages = await countPdfPages(bytes);
            files.push({ name: f.name, size: f.size, bytes, meta: `${pages} sayfa` });
          }
          render();
          toast(`${incoming.length} dosya eklendi`);
        } catch (err) {
          toast(err.message || 'Dosya eklenemedi');
        }
      },
    });

    const list = root.querySelector('#files');
    list?.querySelectorAll('li').forEach((li, i) => {
      li.style.cursor = 'pointer';
      if (i === selected) li.classList.add('is-selected');
      li.addEventListener('click', (e) => {
        if (e.target.closest('[data-remove]')) return;
        selected = i;
        list.querySelectorAll('li').forEach((x) => x.classList.remove('is-selected'));
        li.classList.add('is-selected');
      });
    });

    list?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      files.splice(Number(btn.dataset.remove), 1);
      render();
    });

    root.querySelector('#up')?.addEventListener('click', () => {
      const i = Math.max(0, [...(list?.querySelectorAll('li') || [])].findIndex((li) => li.classList.contains('is-selected')));
      if (i <= 0) return;
      [files[i - 1], files[i]] = [files[i], files[i - 1]];
      selected = i - 1;
      render();
      root.querySelectorAll('#files li')[selected]?.classList.add('is-selected');
    });

    root.querySelector('#down')?.addEventListener('click', () => {
      const i = Math.max(0, [...(list?.querySelectorAll('li') || [])].findIndex((li) => li.classList.contains('is-selected')));
      if (i < 0 || i >= files.length - 1) return;
      [files[i + 1], files[i]] = [files[i], files[i + 1]];
      selected = i + 1;
      render();
      root.querySelectorAll('#files li')[selected]?.classList.add('is-selected');
    });

    root.querySelector('#run')?.addEventListener('click', withLoading(async () => {
      if (files.length < 2) return toast('En az 2 PDF gerekli');
      const out = await mergePdfFiles(files.map((f) => f.bytes));
      downloadBytes(out, 'merged.pdf');
      toast(`Birleştirildi · ${formatBytes(out.byteLength)}`);
    }));
  };

  render();
  return () => { root.innerHTML = ''; };
}
