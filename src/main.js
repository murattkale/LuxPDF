import './styles/main.css';
import './styles/catalog.css';
import { startRouter } from './app/router.js';
import { renderCatalog } from './app/catalog.js';

const app = document.getElementById('app');
let cleanup = null;

const routes = {
  '/': null,
  '/tools/pdf-editor': () => import('./modules/pdf-editor/index.js'),
  '/tools/pdf-compress': () => import('./modules/pdf-compress/index.js'),
  '/tools/pdf-merge': () => import('./modules/pdf-merge/index.js'),
  '/tools/jpg-to-pdf': () => import('./modules/jpg-to-pdf/index.js'),
  '/tools/pdf-to-jpg': () => import('./modules/pdf-to-jpg/index.js'),
};

async function render(route) {
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch { /* ignore */ }
    cleanup = null;
  }

  if (route === '/' || !routes[route]) {
    app.innerHTML = renderCatalog();
    document.title = 'LuxTools — Premium online araçlar';
    return;
  }

  app.innerHTML = `<div class="route-loading"><div class="spinner"></div></div>`;
  const mod = await routes[route]();
  app.innerHTML = '';
  const mountRoot = document.createElement('div');
  mountRoot.className = 'route-root';
  app.appendChild(mountRoot);
  cleanup = await mod.mount(mountRoot);
  if (typeof mod.unmount === 'function') {
    const prev = cleanup;
    cleanup = () => {
      mod.unmount();
      if (typeof prev === 'function') prev();
    };
  }
  document.title = `LuxTools — ${route.split('/').pop()}`;
}

startRouter(render);
