import { icons } from '../ui/icons.js';

/** @typedef {{ id: string, href: string, title: string, desc: string, badge?: string, icon: string, category: string, hot?: boolean }} ToolDef */

/** @type {ToolDef[]} */
export const TOOLS = [
  {
    id: 'pdf-editor',
    href: '#/tools/pdf-editor',
    title: 'PDF Düzenleyici',
    desc: 'Metin düzenle, imza, şekil, vurgu, sayfa yönetimi ve export',
    badge: 'Pro',
    icon: icons.pen,
    category: 'PDF',
    hot: true,
  },
  {
    id: 'pdf-compress',
    href: '#/tools/pdf-compress',
    title: 'PDF Sıkıştır',
    desc: 'Dosya boyutunu küçült, mail ve WhatsApp için optimize et',
    badge: 'Yeni',
    icon: icons.compress,
    category: 'PDF',
    hot: true,
  },
  {
    id: 'pdf-merge',
    href: '#/tools/pdf-merge',
    title: 'PDF Birleştir',
    desc: 'Birden fazla PDF’i tek dosyada birleştir',
    badge: 'Yeni',
    icon: icons.merge,
    category: 'PDF',
    hot: true,
  },
  {
    id: 'jpg-to-pdf',
    href: '#/tools/jpg-to-pdf',
    title: 'JPG → PDF',
    desc: 'Görselleri tek PDF belgesine dönüştür',
    icon: icons.image,
    category: 'Dönüştür',
    hot: true,
  },
  {
    id: 'pdf-to-jpg',
    href: '#/tools/pdf-to-jpg',
    title: 'PDF → JPG',
    desc: 'Her sayfayı yüksek kaliteli görsele çevir, ZIP indir',
    icon: icons.download,
    category: 'Dönüştür',
    hot: true,
  },
];

export function renderCatalog() {
  const groups = [...new Set(TOOLS.map((t) => t.category))];
  return `
  <div class="catalog">
    <header class="catalog-hero">
      <div class="brand">
        <div class="brand-mark">${icons.logo}</div>
        <div>
          <h1>LuxTools</h1>
          <p class="hero-copy">Tarayıcıda çalışan premium araç seti. Dosyalar cihazında kalır — sunucu yok, hesap yok, bekleme yok.</p>
        </div>
      </div>
      <div class="catalog-pills">
        <span>100% client-side</span>
        <span>PDF · Görsel · Dönüştürme</span>
        <span>Gizlilik odaklı</span>
      </div>
    </header>

    <section class="catalog-hot">
      <div class="section-head">
        <h2>Popüler araçlar</h2>
        <p>En çok ihtiyaç duyulan işlemler</p>
      </div>
      <div class="tool-grid">
        ${TOOLS.filter((t) => t.hot).map(toolCard).join('')}
      </div>
    </section>

    ${groups.map((g) => `
      <section class="catalog-section">
        <div class="section-head">
          <h2>${g}</h2>
        </div>
        <div class="tool-grid">
          ${TOOLS.filter((t) => t.category === g).map(toolCard).join('')}
        </div>
      </section>`).join('')}

    <footer class="catalog-foot">
      <p>LuxTools — tamamen tarayıcıda işler. Gelişmiş PDF editöründen hızlı dönüştürücülere kadar hepsi tek yerde.</p>
    </footer>
  </div>`;
}

function toolCard(t) {
  return `
  <a class="tool-card" href="${t.href}">
    <div class="tool-card-icon">${t.icon}</div>
    <div class="tool-card-body">
      <div class="tool-card-title">
        <strong>${t.title}</strong>
        ${t.badge ? `<em>${t.badge}</em>` : ''}
      </div>
      <span>${t.desc}</span>
    </div>
  </a>`;
}
