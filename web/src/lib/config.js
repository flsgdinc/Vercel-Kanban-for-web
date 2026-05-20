const LS_KEY = 'kanban_web_supabase';

/** @returns {{ url: string, anonKey: string } | null} */
export function loadSupabaseConfig() {
  const fromEnv = {
    url: import.meta.env.VITE_SUPABASE_URL?.trim(),
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  };
  if (fromEnv.url && fromEnv.anonKey) return fromEnv;

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.url && parsed?.anonKey) {
      return { url: String(parsed.url).trim(), anonKey: String(parsed.anonKey).trim() };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveSupabaseConfig(url, anonKey) {
  const trimmed = { url: String(url || '').trim(), anonKey: String(anonKey || '').trim() };
  if (!trimmed.url || !trimmed.anonKey) return false;
  localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
  return true;
}

export function clearSupabaseConfig() {
  localStorage.removeItem(LS_KEY);
}

export function normalizeProjectUrl(url) {
  let u = String(url || '').trim();
  if (!u) return '';
  u = u.replace(/\/+$/, '');
  u = u.replace(/\/rest\/v1\/?$/i, '');
  return u;
}
