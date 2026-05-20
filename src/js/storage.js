import { state } from './state.js';
import { createDefaultState } from './constants.js';
import { migrateAndNormalizeState } from './kanban/migrate-state.js';
import { scheduleSaveFlash } from './kanban/save-flash.js';
import { packPersistPayload, unpackPersistPayload } from './state-envelope.js';
import { scheduleCloudAutoSync, touchLocalSaveMeta } from './supabase/cloud-hooks.js';

const LS_KEY = 'kanban_state';
const LS_THEME = 'kanban_theme';

function readTheme() {
  return localStorage.getItem(LS_THEME) === 'dark' ? 'dark' : 'light';
}

function applyUnpacked(unpacked) {
  if (!unpacked?.state) return false;
  Object.assign(state, unpacked.state);
  migrateAndNormalizeState(state);
  if (unpacked.theme) {
    localStorage.setItem(LS_THEME, unpacked.theme === 'dark' ? 'dark' : 'light');
  }
  return true;
}

/** Применить состояние после загрузки из облака (без записи истории undo). */
export function applyRemoteBoardState(unpacked) {
  return applyUnpacked(unpacked);
}

/**
 * Загрузка: файл userData (Electron) → localStorage → дефолты.
 */
export async function hydrateAppState() {
  const api = window.electronAPI;
  let remote = null;
  if (api?.loadState) {
    try {
      remote = await api.loadState();
    } catch (e) {
      console.error('loadState failed', e);
    }
  }

  if (remote && typeof remote === 'object') {
    const unpacked = unpackPersistPayload(remote);
    if (unpacked && applyUnpacked(unpacked)) return;
  }

  const raw = localStorage.getItem(LS_KEY);
  if (raw) {
    try {
      const unpacked = unpackPersistPayload(JSON.parse(raw));
      if (unpacked && applyUnpacked(unpacked)) return;
    } catch (_) {}
  }

  Object.assign(state, createDefaultState());
  migrateAndNormalizeState(state);
}

/** Сохранение в localStorage и файл профиля (единый envelope). */
export function persistAppState() {
  const theme = readTheme();
  const payload = packPersistPayload(state, theme);
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch (_) {}
  if (window.electronAPI?.saveState) {
    void window.electronAPI.saveState(payload);
  }
  touchLocalSaveMeta();
  scheduleCloudAutoSync();
  scheduleSaveFlash();
}

export function saveStateNoHistory() {
  persistAppState();
}
