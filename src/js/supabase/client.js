import { createClient } from '../vendor/supabase.bundle.mjs';
import { loadSupabaseConfig } from './config.js';
import { createElectronAuthStorage } from './electron-storage.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;
let clientUrl = null;

export async function getSupabaseClient() {
  const config = await loadSupabaseConfig();
  if (!config) return null;

  if (client && clientUrl === config.url) {
    return client;
  }

  const storage = createElectronAuthStorage();
  clientUrl = config.url;
  client = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage: storage || undefined,
      storageKey: 'supabase.auth.token'
    }
  });
  return client;
}

export function resetSupabaseClient() {
  client = null;
  clientUrl = null;
}

export async function getSessionUser() {
  const sb = await getSupabaseClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}
