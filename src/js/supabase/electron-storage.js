/** @typedef {import('@supabase/supabase-js').SupportedStorage} SupportedStorage */

/**
 * Persist Supabase auth session in Electron userData (via preload IPC).
 * @returns {SupportedStorage | undefined}
 */
export function createElectronAuthStorage() {
  const api = window.electronAPI;
  if (!api?.supabaseLoadSession || !api?.supabaseSaveSession) return undefined;

  return {
    getItem: async (key) => {
      if (key !== 'supabase.auth.token') return null;
      const data = await api.supabaseLoadSession();
      return data ? JSON.stringify(data) : null;
    },
    setItem: async (key, value) => {
      if (key !== 'supabase.auth.token') return;
      if (!value) {
        await api.supabaseSaveSession(null);
        return;
      }
      try {
        await api.supabaseSaveSession(JSON.parse(value));
      } catch {
        await api.supabaseSaveSession(null);
      }
    },
    removeItem: async (key) => {
      if (key === 'supabase.auth.token') await api.supabaseSaveSession(null);
    }
  };
}
