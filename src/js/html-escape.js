/** Escape text for HTML text nodes and attribute values. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape for single-quoted HTML attributes (onclick handlers). */
export function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
