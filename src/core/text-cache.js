/** Shared cache for extracted PDF text items (avoids circular imports). */
export const textItemCache = new Map();

export function clearTextCache() {
  textItemCache.clear();
}
