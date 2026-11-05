# LuxTools

Tarayıcıda çalışan, veritabanı gerektirmeyen premium araç seti. PDF düzenleme, sıkıştırma, birleştirme ve dönüştürme.

## Canlı

**https://murattkale.github.io/LuxPDF/**

## Çalıştırma

```bash
npm install
npm run dev
```

Üretim:

```bash
npm run build
npm run preview
```

## Araçlar

| Araç | Rota |
|---|---|
| Katalog | `#/` |
| PDF Düzenleyici | `#/tools/pdf-editor` |
| PDF Sıkıştır | `#/tools/pdf-compress` |
| PDF Birleştir | `#/tools/pdf-merge` |
| JPG → PDF | `#/tools/jpg-to-pdf` |
| PDF → JPG | `#/tools/pdf-to-jpg` |

Hepsi istemci tarafında çalışır (`pdf.js`, `pdf-lib`, `jszip`).
