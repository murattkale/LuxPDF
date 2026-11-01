import { state, getPageAnnos, uid, pushHistory } from './state.js';
import { cssToPdfPoint, pageCssSize } from './pdf-engine.js';

export function findAnnoAt(page, cssX, cssY) {
  const list = getPageAnnos(page);
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    const box = getAnnoCssBox(a);
    if (!box) continue;
    if (cssX >= box.x && cssX <= box.x + box.w && cssY >= box.y && cssY <= box.y + box.h) {
      return a;
    }
  }
  return null;
}

export function getAnnoCssBox(anno) {
  const d = anno.data;
  const s = state.scale;
  if (['text', 'textEdit', 'sticky', 'image', 'signature', 'stamp', 'rect', 'ellipse', 'redaction'].includes(anno.type)) {
    return { x: d.x * s, y: d.y * s, w: (d.w || 100) * s, h: (d.h || 40) * s };
  }
  if (anno.type === 'line' || anno.type === 'arrow') {
    const x = Math.min(d.x1, d.x2) * s;
    const y = Math.min(d.y1, d.y2) * s;
    const w = Math.abs(d.x2 - d.x1) * s || 8;
    const h = Math.abs(d.y2 - d.y1) * s || 8;
    return { x, y, w, h };
  }
  if (anno.type === 'pen' || anno.type === 'highlight') {
    const xs = d.points.map((p) => p.x);
    const ys = d.points.map((p) => p.y);
    const pad = (d.width || 2) + 4;
    return {
      x: (Math.min(...xs) - pad) * s,
      y: (Math.min(...ys) - pad) * s,
      w: (Math.max(...xs) - Math.min(...xs) + pad * 2) * s,
      h: (Math.max(...ys) - Math.min(...ys) + pad * 2) * s,
    };
  }
  return null;
}

export function deleteSelected() {
  if (!state.selectedAnno) return false;
  const list = getPageAnnos(state.selectedAnno.page);
  const idx = list.findIndex((a) => a.id === state.selectedAnno.id);
  if (idx >= 0) {
    pushHistory();
    list.splice(idx, 1);
    state.selectedAnno = null;
    return true;
  }
  return false;
}

export function eraseNear(page, cssX, cssY, radius = 18) {
  const pt = cssToPdfPoint(page, cssX, cssY);
  const list = getPageAnnos(page);
  let changed = false;
  for (let i = list.length - 1; i >= 0; i--) {
    const a = list[i];
    if (a.type === 'pen' || a.type === 'highlight') {
      const hit = a.data.points.some((p) => {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        return dx * dx + dy * dy <= (radius / state.scale) ** 2;
      });
      if (hit) {
        if (!changed) pushHistory();
        list.splice(i, 1);
        changed = true;
      }
    } else {
      const box = getAnnoCssBox(a);
      if (box && cssX >= box.x && cssX <= box.x + box.w && cssY >= box.y && cssY <= box.y + box.h) {
        if (!changed) pushHistory();
        list.splice(i, 1);
        changed = true;
      }
    }
  }
  return changed;
}

export function drawAnnotations(ctx, page, cssW, cssH) {
  const list = getPageAnnos(page);
  const s = state.scale;
  const dpr = state.dpr;
  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  for (const anno of list) {
    const d = anno.data;
    const selected = state.selectedAnno?.id === anno.id;
    ctx.save();
    ctx.globalAlpha = d.opacity ?? 1;

    if (anno.type === 'pen' || anno.type === 'highlight') {
      const pts = d.points;
      if (pts.length > 1) {
        ctx.beginPath();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = d.color;
        ctx.lineWidth = d.width || (anno.type === 'highlight' ? 16 : 2.5);
        if (anno.type === 'highlight') ctx.globalAlpha = 0.35;
        ctx.moveTo(pts[0].x * s, pts[0].y * s);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * s, pts[i].y * s);
        ctx.stroke();
      }
    } else if (anno.type === 'rect' || anno.type === 'redaction') {
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.color || '#000';
      if (anno.type === 'redaction') {
        ctx.fillStyle = '#000';
        ctx.fillRect(d.x * s, d.y * s, d.w * s, d.h * s);
      } else {
        if (d.fill) {
          ctx.fillStyle = d.fill;
          ctx.fillRect(d.x * s, d.y * s, d.w * s, d.h * s);
        }
        ctx.strokeRect(d.x * s, d.y * s, d.w * s, d.h * s);
      }
    } else if (anno.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(
        (d.x + d.w / 2) * s,
        (d.y + d.h / 2) * s,
        Math.abs(d.w / 2) * s,
        Math.abs(d.h / 2) * s,
        0,
        0,
        Math.PI * 2,
      );
      if (d.fill) {
        ctx.fillStyle = d.fill;
        ctx.fill();
      }
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.color || '#0f766e';
      ctx.stroke();
    } else if (anno.type === 'line' || anno.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(d.x1 * s, d.y1 * s);
      ctx.lineTo(d.x2 * s, d.y2 * s);
      ctx.lineWidth = d.strokeWidth || 2;
      ctx.strokeStyle = d.color || '#0f766e';
      ctx.stroke();
      if (anno.type === 'arrow') {
        const ang = Math.atan2(d.y2 - d.y1, d.x2 - d.x1);
        const ah = 12;
        ctx.beginPath();
        ctx.moveTo(d.x2 * s, d.y2 * s);
        ctx.lineTo((d.x2 - Math.cos(ang - 0.5) * ah) * s, (d.y2 - Math.sin(ang - 0.5) * ah) * s);
        ctx.lineTo((d.x2 - Math.cos(ang + 0.5) * ah) * s, (d.y2 - Math.sin(ang + 0.5) * ah) * s);
        ctx.closePath();
        ctx.fillStyle = d.color || '#0f766e';
        ctx.fill();
      }
    } else if (anno.type === 'textEdit') {
      ctx.fillStyle = d.coverColor || '#ffffff';
      ctx.fillRect(d.x * s, d.y * s, d.w * s, d.h * s);
      ctx.fillStyle = d.color || '#12181f';
      ctx.font = `${(d.fontSize || 12) * s}px ${d.fontFamily || 'Helvetica'}, Outfit, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = String(d.text || '').split('\n');
      const fs = d.fontSize || 12;
      lines.forEach((line, i) => {
        ctx.fillText(line, (d.x + 1.5) * s, (d.y + 1 + i * fs * 1.2) * s);
      });
    } else if (anno.type === 'text') {
      ctx.fillStyle = d.color || '#12181f';
      ctx.font = `${d.fontSize * s}px ${d.fontFamily || 'Helvetica'}, Outfit, sans-serif`;
      const lines = String(d.text || 'Metin').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, d.x * s, (d.y + d.fontSize + i * d.fontSize * 1.25) * s);
      });
    } else if (anno.type === 'sticky') {
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(d.x * s, d.y * s, (d.w || 140) * s, (d.h || 80) * s);
      ctx.strokeStyle = '#eab308';
      ctx.strokeRect(d.x * s, d.y * s, (d.w || 140) * s, (d.h || 80) * s);
      ctx.fillStyle = '#422006';
      ctx.font = `${(d.fontSize || 14) * s}px Outfit, sans-serif`;
      const lines = String(d.text || 'Not').split('\n');
      lines.forEach((line, i) => {
        ctx.fillText(line, (d.x + 8) * s, (d.y + 18 + i * 16) * s, ((d.w || 140) - 16) * s);
      });
    } else if ((anno.type === 'image' || anno.type === 'signature' || anno.type === 'stamp') && d._img) {
      ctx.drawImage(d._img, d.x * s, d.y * s, d.w * s, d.h * s);
    }

    if (selected) {
      const box = getAnnoCssBox(anno);
      if (box) {
        ctx.globalAlpha = 1;
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(box.x - 2, box.y - 2, box.w + 4, box.h + 4);
      }
    }
    ctx.restore();
  }

  if (state.currentStroke && state.currentStroke.page === page) {
    const d = state.currentStroke;
    const pts = d.points;
    if (pts.length > 1) {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.width;
      ctx.globalAlpha = d.type === 'highlight' ? 0.35 : (d.opacity ?? 1);
      ctx.moveTo(pts[0].x * s, pts[0].y * s);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * s, pts[i].y * s);
      ctx.stroke();
    }
  }

  if (state.tempShape && state.tempShape.page === page) {
    paintTemp(ctx, state.tempShape, s);
  }
  ctx.restore();
}

function paintTemp(ctx, d, s) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = d.strokeWidth || state.strokeWidth;
  ctx.strokeStyle = d.color || state.color;
  if (d.type === 'rect' || d.type === 'redaction') {
    if (d.type === 'redaction') {
      ctx.fillStyle = '#000';
      ctx.fillRect(d.x * s, d.y * s, d.w * s, d.h * s);
    } else {
      ctx.strokeRect(d.x * s, d.y * s, d.w * s, d.h * s);
    }
  } else if (d.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse((d.x + d.w / 2) * s, (d.y + d.h / 2) * s, Math.abs(d.w / 2) * s, Math.abs(d.h / 2) * s, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (d.type === 'line' || d.type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(d.x1 * s, d.y1 * s);
    ctx.lineTo(d.x2 * s, d.y2 * s);
    ctx.stroke();
  }
  ctx.restore();
}

export function ensureImageLoaded(anno) {
  return new Promise((resolve) => {
    if (!anno.data.src) return resolve();
    if (anno.data._img?.complete) return resolve();
    const img = new Image();
    img.onload = () => {
      anno.data._img = img;
      resolve();
    };
    img.onerror = () => resolve();
    img.src = anno.data.src;
  });
}

export async function preloadImages(page) {
  const list = getPageAnnos(page);
  await Promise.all(list.filter((a) => ['image', 'signature', 'stamp'].includes(a.type)).map(ensureImageLoaded));
}

export function addTextAt(page, cssX, cssY, text = 'Metin yazın') {
  pushHistory();
  const pt = cssToPdfPoint(page, cssX, cssY);
  const anno = {
    id: uid('text'),
    type: 'text',
    page,
    data: {
      x: pt.x,
      y: pt.y,
      w: 180,
      h: 28,
      text,
      color: state.color,
      fontSize: state.fontSize,
      fontFamily: state.fontFamily,
      opacity: 1,
    },
  };
  getPageAnnos(page).push(anno);
  state.selectedAnno = anno;
  return anno;
}

export function addStickyAt(page, cssX, cssY) {
  pushHistory();
  const pt = cssToPdfPoint(page, cssX, cssY);
  const anno = {
    id: uid('sticky'),
    type: 'sticky',
    page,
    data: {
      x: pt.x,
      y: pt.y,
      w: 150,
      h: 90,
      text: 'Yeni not',
      fontSize: 14,
      color: '#422006',
      opacity: 1,
    },
  };
  getPageAnnos(page).push(anno);
  state.selectedAnno = anno;
  return anno;
}

export function addImageAnno(page, cssX, cssY, src, w, h, type = 'image') {
  pushHistory();
  const pt = cssToPdfPoint(page, cssX, cssY);
  const maxW = 220;
  const scale = w > maxW ? maxW / w : 1;
  const anno = {
    id: uid(type),
    type,
    page,
    data: {
      x: pt.x,
      y: pt.y,
      w: (w * scale),
      h: (h * scale),
      src,
      opacity: 1,
    },
  };
  getPageAnnos(page).push(anno);
  state.selectedAnno = anno;
  return ensureImageLoaded(anno).then(() => anno);
}

export function commitStroke() {
  if (!state.currentStroke || state.currentStroke.points.length < 2) {
    state.currentStroke = null;
    return null;
  }
  pushHistory();
  const s = state.currentStroke;
  const anno = {
    id: uid(s.type),
    type: s.type,
    page: s.page,
    data: {
      points: s.points,
      color: s.color,
      width: s.width,
      opacity: s.opacity ?? 1,
    },
  };
  getPageAnnos(s.page).push(anno);
  state.currentStroke = null;
  return anno;
}

export function commitShape() {
  if (!state.tempShape) return null;
  pushHistory();
  const d = state.tempShape;
  let anno;
  if (d.type === 'line' || d.type === 'arrow') {
    anno = {
      id: uid(d.type),
      type: d.type,
      page: d.page,
      data: {
        x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
        color: d.color,
        strokeWidth: d.strokeWidth,
        opacity: 1,
      },
    };
  } else {
    const x = Math.min(d.x, d.x + d.w);
    const y = Math.min(d.y, d.y + d.h);
    const w = Math.abs(d.w);
    const h = Math.abs(d.h);
    if (w < 2 && h < 2) {
      state.tempShape = null;
      return null;
    }
    anno = {
      id: uid(d.type),
      type: d.type,
      page: d.page,
      data: {
        x, y, w, h,
        color: d.color,
        fill: d.fill,
        strokeWidth: d.strokeWidth,
        opacity: 1,
      },
    };
  }
  getPageAnnos(d.page).push(anno);
  state.tempShape = null;
  state.selectedAnno = anno;
  return anno;
}

export function exportAnnotationsHtml() {
  const parts = [];
  for (const [page, list] of state.annotations.entries()) {
    for (const a of list) {
      parts.push({ page, type: a.type, data: { ...a.data, _img: undefined } });
    }
  }
  return parts;
}

export { pageCssSize };
