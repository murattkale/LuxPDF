export function formatBytes(n) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function stemName(name = 'file') {
  return String(name).replace(/\.[^.]+$/, '') || 'file';
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadBytes(bytes, name, mime = 'application/pdf') {
  downloadBlob(new Blob([bytes], { type: mime }), name);
}

export async function readFileBytes(file) {
  return new Uint8Array(await file.arrayBuffer());
}
