import { packPersistPayload, unpackPersistPayload, validateImportPayload } from '../state-envelope.js';
import { getSupabaseClient, getSessionUser } from './client.js';

const LS_CLOUD_META = 'kanban_cloud_meta';

export function readCloudMeta() {
  try {
    const raw = localStorage.getItem(LS_CLOUD_META);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeCloudMeta(patch) {
  const next = { ...readCloudMeta(), ...patch };
  localStorage.setItem(LS_CLOUD_META, JSON.stringify(next));
}

function readTheme() {
  return localStorage.getItem('kanban_theme') === 'dark' ? 'dark' : 'light';
}

export function buildLocalPayload(state) {
  return packPersistPayload(state, readTheme());
}

/**
 * @param {object} state
 * @returns {Promise<{ ok: true, updatedAt: string } | { ok: false, error: string }>}
 */
export async function pushBoardToCloud(state) {
  const sb = await getSupabaseClient();
  const user = await getSessionUser();
  if (!sb) return { ok: false, error: 'Укажите URL и ключ Supabase в настройках' };
  if (!user) return { ok: false, error: 'Войдите в аккаунт' };

  const payload = buildLocalPayload(state);
  const updatedAt = new Date().toISOString();
  const { error } = await sb.from('kanban_boards').upsert(
    { user_id: user.id, payload, updated_at: updatedAt },
    { onConflict: 'user_id' }
  );
  if (error) return { ok: false, error: error.message };

  writeCloudMeta({ lastPushAt: updatedAt, lastCloudUpdatedAt: updatedAt });
  return { ok: true, updatedAt };
}

/**
 * @returns {Promise<{ ok: true, payload: object, updatedAt: string } | { ok: false, error: string, empty?: boolean }>}
 */
export async function pullBoardFromCloud() {
  const sb = await getSupabaseClient();
  const user = await getSessionUser();
  if (!sb) return { ok: false, error: 'Укажите URL и ключ Supabase в настройках' };
  if (!user) return { ok: false, error: 'Войдите в аккаунт' };

  const { data, error } = await sb
    .from('kanban_boards')
    .select('payload, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data?.payload) return { ok: false, error: 'В облаке пока нет данных', empty: true };

  const validated = validateImportPayload(data.payload);
  if (!validated.ok) return { ok: false, error: validated.error };

  const updatedAt = data.updated_at || new Date().toISOString();
  writeCloudMeta({ lastPullAt: updatedAt, lastCloudUpdatedAt: updatedAt });
  return { ok: true, payload: data.payload, updatedAt, state: validated.state, theme: validated.theme };
}

/**
 * Last-write-wins по updated_at в kanban_boards.
 * @param {object} state
 * @param {{ localSavedAt?: string }} [opts]
 */
export async function syncBoardWithCloud(state, opts = {}) {
  const sb = await getSupabaseClient();
  const user = await getSessionUser();
  if (!sb) return { ok: false, error: 'Укажите URL и ключ Supabase в настройках' };
  if (!user) return { ok: false, error: 'Войдите в аккаунт' };

  const { data, error } = await sb
    .from('kanban_boards')
    .select('payload, updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  const localPayload = buildLocalPayload(state);
  const localAt = opts.localSavedAt || readCloudMeta().lastLocalSaveAt || new Date().toISOString();

  if (!data?.payload) {
    const push = await pushBoardToCloud(state);
    if (!push.ok) return push;
    return { ok: true, action: 'pushed', updatedAt: push.updatedAt };
  }

  const cloudAt = data.updated_at ? new Date(data.updated_at).getTime() : 0;
  const localMs = new Date(localAt).getTime();

  if (cloudAt > localMs) {
    const validated = validateImportPayload(data.payload);
    if (!validated.ok) return { ok: false, error: validated.error };
    writeCloudMeta({ lastPullAt: data.updated_at, lastCloudUpdatedAt: data.updated_at });
    return {
      ok: true,
      action: 'pulled',
      updatedAt: data.updated_at,
      state: validated.state,
      theme: validated.theme
    };
  }

  if (localMs > cloudAt) {
    const push = await pushBoardToCloud(state);
    if (!push.ok) return push;
    return { ok: true, action: 'pushed', updatedAt: push.updatedAt };
  }

  const unpackedLocal = unpackPersistPayload(localPayload);
  const unpackedCloud = unpackPersistPayload(data.payload);
  const localJson = JSON.stringify(unpackedLocal?.state ?? {});
  const cloudJson = JSON.stringify(unpackedCloud?.state ?? {});
  if (localJson === cloudJson) {
    return { ok: true, action: 'unchanged', updatedAt: data.updated_at };
  }

  const push = await pushBoardToCloud(state);
  if (!push.ok) return push;
  return { ok: true, action: 'pushed', updatedAt: push.updatedAt };
}
