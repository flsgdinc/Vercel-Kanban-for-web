let cachedConfig = null;

export async function loadSupabaseConfig() {
  if (cachedConfig) return cachedConfig;
  const api = window.electronAPI;
  if (api?.supabaseLoadConfig) {
    const fromDisk = await api.supabaseLoadConfig();
    if (fromDisk?.url && fromDisk?.anonKey) {
      cachedConfig = { url: fromDisk.url.trim(), anonKey: fromDisk.anonKey.trim() };
      return cachedConfig;
    }
  }
  return null;
}

export async function saveSupabaseConfig(url, anonKey) {
  const trimmed = { url: String(url || '').trim(), anonKey: String(anonKey || '').trim() };
  if (!trimmed.url || !trimmed.anonKey) return false;
  const api = window.electronAPI;
  if (!api?.supabaseSaveConfig) return false;
  const ok = await api.supabaseSaveConfig(trimmed);
  if (ok) cachedConfig = trimmed;
  return ok;
}

export function clearSupabaseConfigCache() {
  cachedConfig = null;
}

export function isSupabaseConfigured(config) {
  return !!(config?.url && config?.anonKey);
}
