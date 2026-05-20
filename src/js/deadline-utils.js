export function deadlineStatus(dl) {
  if (!dl) return null;
  const now = new Date();
  const d = new Date(dl);
  const diff = (d - now) / 3600000;
  if (diff < 0) return 'overdue';
  if (diff < 48) return 'soon';
  return 'ok';
}

export function deadlineLabel(dl) {
  if (!dl) return '';
  try {
    const d = new Date(dl);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const hasTime = String(dl).includes('T');
    return hasTime ? `${dd}-${mm}-${yyyy} ${hh}:${mi}` : `${dd}-${mm}-${yyyy}`;
  } catch {
    return dl.slice(0, 10);
  }
}
