import { createClient } from '@supabase/supabase-js';
import { loadSupabaseConfig, normalizeProjectUrl } from './config.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;
let clientKey = '';

export function resetSupabaseClient() {
  client = null;
  clientKey = '';
}

export function getSupabaseClient() {
  const config = loadSupabaseConfig();
  if (!config) return null;

  const url = normalizeProjectUrl(config.url);
  const key = config.anonKey;
  const cacheKey = `${url}|${key}`;
  if (client && clientKey === cacheKey) return client;

  clientKey = cacheKey;
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}
