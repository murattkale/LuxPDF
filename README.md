# LuxPDF

Tarayıcıda çalışan, veritabanı gerektirmeyen premium PDF düzenleyici.

## Çalıştırma

```bash
npm install
npm run dev
```

Üretim derlemesi:

```bash
npm run build
npm run preview
```

## Özellikler

- PDF yükleme / boş belge / HTML içe aktarma
- Metin, kalem, vurgulama, şekiller, ok, yapışkan not
- Görsel, imza, damga, karartma, silgi
- Sayfa döndürme, ekleme, silme, çoğaltma
- PDF birleştirme, sayfa ayırma / çıkarma
- Filigran ve sayfa numarası
- PDF + HTML export
- Undo/redo, zoom, responsive arayüz
- Tercihler `localStorage` içinde (sunucu yok)

Her şey istemci tarafında çalışır: `pdf.js` + `pdf-lib`.
