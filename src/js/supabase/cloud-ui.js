import { state } from '../state.js';
import { saveStateNoHistory, applyRemoteBoardState } from '../storage.js';
import { migrateAndNormalizeState } from '../kanban/migrate-state.js';
import { loadSupabaseConfig, saveSupabaseConfig, isSupabaseConfigured } from './config.js';
import { getSupabaseClient, resetSupabaseClient, getSessionUser } from './client.js';
import { pushBoardToCloud, pullBoardFromCloud, syncBoardWithCloud, readCloudMeta, writeCloudMeta } from './sync.js';
import { registerCloudPersistHooks } from './cloud-hooks.js';

let refreshCb = null;
let syncInFlight = false;

function el(id) {
  return document.getElementById(id);
}

function setCloudStatus(text, isError = false) {
  const node = el('cloudSyncStatus');
  if (!node) return;
  node.textContent = text || '';
  node.classList.toggle('cloud-status-error', !!isError);
}

async function refreshCloudAuthUi() {
  const signedInRow = el('cloudSignedInRow');
  const signInRow = el('cloudSignInRow');
  const emailEl = el('cloudUserEmail');
  const config = await loadSupabaseConfig();
  const configured = isSupabaseConfigured(config);

  if (!configured) {
    setCloudStatus('Укажите URL проекта и anon/publishable ключ');
    if (signedInRow) signedInRow.style.display = 'none';
    if (signInRow) signInRow.style.display = '';
    if (emailEl) emailEl.textContent = '';
    return;
  }

  let user = null;
  try {
    user = await getSessionUser();
  } catch (e) {
    setCloudStatus(e?.message || 'Ошибка сессии', true);
  }

  if (user) {
    if (signedInRow) signedInRow.style.display = '';
    if (signInRow) signInRow.style.display = 'none';
    if (emailEl) emailEl.textContent = user.email || user.id;
    const meta = readCloudMeta();
    const hint = meta.lastCloudUpdatedAt
      ? `Облако: ${new Date(meta.lastCloudUpdatedAt).toLocaleString('ru-RU')}`
      : 'Вход выполнен';
    setCloudStatus(hint);
  } else {
    if (signedInRow) signedInRow.style.display = 'none';
    if (signInRow) signInRow.style.display = '';
    if (emailEl) emailEl.textContent = '';
    setCloudStatus('Войдите, чтобы синхронизировать доску');
  }
}

export function initCloudUi({ onAfterRemoteApply } = {}) {
  refreshCb = onAfterRemoteApply;
  registerCloudPersistHooks({
    scheduleAutoSync: scheduleCloudAutoSync,
    touchLocalSave: touchLocalSaveMeta
  });

  el('cloudSaveConfigBtn')?.addEventListener('click', async () => {
    const url = el('cloudSupabaseUrl')?.value;
    let anonKey = el('cloudAnonKey')?.value?.trim();
    if (!anonKey || anonKey.includes('••••')) {
      const existing = await loadSupabaseConfig();
      anonKey = existing?.anonKey || '';
    }
    const ok = await saveSupabaseConfig(url, anonKey);
    if (!ok) {
      setCloudStatus('Не удалось сохранить настройки Supabase', true);
      return;
    }
    resetSupabaseClient();
    setCloudStatus('Параметры Supabase сохранены');
    await refreshCloudAuthUi();
  });

  el('cloudSignInBtn')?.addEventListener('click', async () => {
    const email = el('cloudEmail')?.value?.trim();
    const password = el('cloudPassword')?.value;
    if (!email || !password) {
      setCloudStatus('Введите email и пароль', true);
      return;
    }
    const sb = await getSupabaseClient();
    if (!sb) {
      setCloudStatus('Сначала сохраните URL и ключ', true);
      return;
    }
    setCloudStatus('Вход…');
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      setCloudStatus(error.message, true);
      return;
    }
    setCloudStatus('Вход выполнен');
    await refreshCloudAuthUi();
  });

  el('cloudSignUpBtn')?.addEventListener('click', async () => {
    const email = el('cloudEmail')?.value?.trim();
    const password = el('cloudPassword')?.value;
    if (!email || !password) {
      setCloudStatus('Введите email и пароль', true);
      return;
    }
    const sb = await getSupabaseClient();
    if (!sb) {
      setCloudStatus('Сначала сохраните URL и ключ', true);
      return;
    }
    setCloudStatus('Регистрация…');
    const { error } = await sb.auth.signUp({ email, password });
    if (error) {
      setCloudStatus(error.message, true);
      return;
    }
    setCloudStatus('Проверьте почту или войдите, если подтверждение отключено');
    await refreshCloudAuthUi();
  });

  el('cloudSignOutBtn')?.addEventListener('click', async () => {
    const sb = await getSupabaseClient();
    if (sb) await sb.auth.signOut();
    resetSupabaseClient();
    setCloudStatus('Вы вышли из аккаунта');
    await refreshCloudAuthUi();
  });

  el('cloudSyncNowBtn')?.addEventListener('click', () => void runCloudSync());
  el('cloudPushBtn')?.addEventListener('click', () => void runCloudPush());
  el('cloudPullBtn')?.addEventListener('click', () => void runCloudPull(true));
}

export async function populateCloudSettingsFields() {
  const config = await loadSupabaseConfig();
  if (config) {
    const urlInput = el('cloudSupabaseUrl');
    const keyInput = el('cloudAnonKey');
    if (urlInput && !urlInput.value) urlInput.value = config.url;
    if (keyInput && !keyInput.value) keyInput.placeholder = '•••••••• (сохранён)';
  }
  const auto = el('setCloudAutoSync');
  if (auto) auto.checked = !!state.appSettings?.cloudAutoSync;
  await refreshCloudAuthUi();
}

export function readCloudAutoSyncFromForm() {
  return !!el('setCloudAutoSync')?.checked;
}

async function afterRemoteState(theme) {
  migrateAndNormalizeState(state);
  if (theme) {
    localStorage.setItem('kanban_theme', theme === 'dark' ? 'dark' : 'light');
    document.body.classList.toggle('dark', theme === 'dark');
  }
  saveStateNoHistory();
  refreshCb?.();
}

export async function runCloudPush() {
  if (syncInFlight) return;
  syncInFlight = true;
  setCloudStatus('Отправка в облако…');
  try {
    const res = await pushBoardToCloud(state);
    if (!res.ok) {
      setCloudStatus(res.error, true);
      return;
    }
    setCloudStatus(`Загружено в облако: ${new Date(res.updatedAt).toLocaleString('ru-RU')}`);
  } finally {
    syncInFlight = false;
  }
}

export async function runCloudPull(force = false) {
  if (syncInFlight) return;
  syncInFlight = true;
  setCloudStatus('Загрузка из облака…');
  try {
    const res = await pullBoardFromCloud();
    if (!res.ok) {
      if (!force && res.empty) setCloudStatus(res.error);
      else setCloudStatus(res.error, true);
      return;
    }
    applyRemoteBoardState({ state: res.state, theme: res.theme });
    await afterRemoteState(res.theme);
    setCloudStatus(`Скачано из облака: ${new Date(res.updatedAt).toLocaleString('ru-RU')}`);
  } finally {
    syncInFlight = false;
  }
}

export async function runCloudSync() {
  if (syncInFlight) return;
  syncInFlight = true;
  setCloudStatus('Синхронизация…');
  try {
    const meta = readCloudMeta();
    const res = await syncBoardWithCloud(state, { localSavedAt: meta.lastLocalSaveAt });
    if (!res.ok) {
      setCloudStatus(res.error, true);
      return;
    }
    if (res.action === 'pulled' && res.state) {
      applyRemoteBoardState({ state: res.state, theme: res.theme });
      await afterRemoteState(res.theme);
      setCloudStatus(`Обновлено из облака (${new Date(res.updatedAt).toLocaleString('ru-RU')})`);
      return;
    }
    if (res.action === 'pushed') {
      setCloudStatus(`Отправлено в облако (${new Date(res.updatedAt).toLocaleString('ru-RU')})`);
      return;
    }
    setCloudStatus('Уже синхронизировано');
  } finally {
    syncInFlight = false;
  }
}

/** Debounced auto-sync after local save (if enabled in settings). */
let autoSyncTimer = null;
export function scheduleCloudAutoSync() {
  if (!state.appSettings?.cloudAutoSync) return;
  clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    void runCloudSync().catch((e) => console.error('auto sync', e));
  }, 2500);
}

export function touchLocalSaveMeta() {
  writeCloudMeta({ lastLocalSaveAt: new Date().toISOString() });
}
