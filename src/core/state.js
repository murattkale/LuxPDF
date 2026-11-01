/** @typedef {'select'|'hand'|'text'|'editText'|'pen'|'highlight'|'rect'|'ellipse'|'line'|'arrow'|'image'|'signature'|'stamp'|'eraser'|'redaction'|'sticky'} ToolId */

export const state = {
  fileName: 'untitled.pdf',
  pdfBytes: null,
  pdfDoc: null,
  pageCount: 0,
  currentPage: 1,
  scale: 1.15,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
  /** @type {ToolId} */
  tool: 'select',
  color: '#0f766e',
  fillColor: '#0f766e33',
  strokeWidth: 2.5,
  fontSize: 18,
  fontFamily: 'Helvetica',
  opacity: 1,
  highlightColor: '#facc15',
  /** @type {Map<number, Annotation[]>} */
  annotations: new Map(),
  selectedAnno: null,
  drawing: false,
  currentStroke: null,
  tempShape: null,
  history: [],
  future: [],
  dirty: false,
  renderToken: 0,
  pageSizes: [],
  isPanning: false,
  _pendingImagePoint: null,
  hoveredNativeText: null,
  textItemsByPage: new Map(),
};

/**
 * @typedef {Object} Annotation
 * @property {string} id
 * @property {string} type
 * @property {number} page
 * @property {object} data
 */

export function uid(prefix = 'a') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function getPageAnnos(page) {
  if (!state.annotations.has(page)) state.annotations.set(page, []);
  return state.annotations.get(page);
}

export function cloneAnnos() {
  const out = [];
  for (const [page, list] of state.annotations.entries()) {
    for (const a of list) out.push({ ...a, page, data: structuredClone(a.data) });
  }
  return out;
}

export function restoreAnnos(snapshot) {
  state.annotations.clear();
  for (const a of snapshot) {
    const list = getPageAnnos(a.page);
    list.push({ id: a.id, type: a.type, page: a.page, data: structuredClone(a.data) });
  }
  state.selectedAnno = null;
}

export function pushHistory() {
  state.history.push(cloneAnnos());
  if (state.history.length > 60) state.history.shift();
  state.future = [];
  state.dirty = true;
}

export function undo() {
  if (!state.history.length) return false;
  state.future.push(cloneAnnos());
  restoreAnnos(state.history.pop());
  state.dirty = true;
  return true;
}

export function redo() {
  if (!state.future.length) return false;
  state.history.push(cloneAnnos());
  restoreAnnos(state.future.pop());
  state.dirty = true;
  return true;
}

export function resetDocumentState() {
  state.annotations.clear();
  state.selectedAnno = null;
  state.history = [];
  state.future = [];
  state.currentPage = 1;
  state.dirty = false;
  state.drawing = false;
  state.currentStroke = null;
  state.tempShape = null;
  state.hoveredNativeText = null;
  state.textItemsByPage = new Map();
}
