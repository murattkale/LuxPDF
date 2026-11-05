/**
 * Tiny hash router for GitHub Pages compatibility.
 * Routes: '#/', '#/tools/pdf-editor', ...
 */

export function getRoute() {
  const raw = (location.hash || '#/').replace(/^#/, '') || '/';
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  return path.split('?')[0].replace(/\/+$/, '') || '/';
}

export function navigate(path) {
  const next = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (location.hash === next) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  location.hash = next;
}

/**
 * @param {(route: string) => void | Promise<void>} handler
 */
export function startRouter(handler) {
  const run = () => {
    Promise.resolve(handler(getRoute())).catch((err) => {
      console.error(err);
    });
  };
  window.addEventListener('hashchange', run);
  if (!location.hash) location.hash = '#/';
  else run();
  return () => window.removeEventListener('hashchange', run);
}
