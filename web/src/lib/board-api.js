import { packPersistPayload, validateImportPayload } from '@envelope';
import { getSupabaseClient } from './supabase.js';

/**
 * @returns {Promise<{ ok: true, state: object, theme: string, updatedAt: string } | { ok: false, error: string, empty?: boolean }>}
 */
export async function fetchBoardFromCloud() {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'Укажите URL и ключ Supabase' };

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) return { ok: false, error: userErr.message };
  if (!userData.user) return { ok: false, error: 'Войдите в аккаунт' };

  const { data, error } = await sb
    .from('kanban_boards')
    .select('payload, updated_at')
    .eq('user_id', userData.user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.payload) return { ok: false, error: 'В облаке пока нет данных', empty: true };

  const validated = validateImportPayload(data.payload);
  if (!validated.ok) return { ok: false, error: validated.error };

  return {
    ok: true,
    state: validated.state,
    theme: validated.theme || 'light',
    updatedAt: data.updated_at || new Date().toISOString()
  };
}

/**
 * @param {object} state
 * @param {string} [expectedUpdatedAt] — if set and cloud is newer, returns conflict
 * @param {string} [theme] — 'dark' | 'light', как в десктопе; не перезаписывать на light
 */
export async function saveBoardToCloud(state, expectedUpdatedAt, theme = 'light') {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, error: 'Укажите URL и ключ Supabase' };

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr) return { ok: false, error: userErr.message };
  if (!userData.user) return { ok: false, error: 'Войдите в аккаунт' };

  if (expectedUpdatedAt) {
    const { data: current, error: readErr } = await sb
      .from('kanban_boards')
      .select('updated_at')
      .eq('user_id', userData.user.id)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (current?.updated_at && current.updated_at !== expectedUpdatedAt) {
      const cloudMs = new Date(current.updated_at).getTime();
      const localMs = new Date(expectedUpdatedAt).getTime();
      if (cloudMs > localMs) {
        return {
          ok: false,
          conflict: true,
          error: 'В облаке более новая версия. Обновите данные перед сохранением.',
          cloudUpdatedAt: current.updated_at
        };
      }
    }
  }

  const payload = packPersistPayload(state, theme === 'dark' ? 'dark' : 'light');
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from('kanban_boards').upsert(
    { user_id: userData.user.id, payload, updated_at: updatedAt },
    { onConflict: 'user_id' }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, updatedAt };
}
