import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths work on Vercel and GitHub Pages
  base: './',
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    // pdf.js / pdf-lib are large by nature; split them and raise the noise floor
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfjs-dist')) return 'pdfjs';
          if (id.includes('pdf-lib')) return 'pdf-lib';
        },
      },
    },
  },
  optimizeDeps: {
    include: ['pdf-lib', 'pdfjs-dist'],
  },
});
