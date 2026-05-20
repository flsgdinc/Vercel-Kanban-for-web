/** Persisted file / localStorage format version. */
export const PERSIST_VERSION = 2;

export const EXPORT_VERSION = '2.0';

const MAX_IMPORT_BYTES = 15_000_000;
const MAX_COLUMNS = 200;

export function packPersistPayload(state, theme = 'light') {
  return {
    version: PERSIST_VERSION,
    theme: theme === 'dark' ? 'dark' : 'light',
    state: JSON.parse(JSON.stringify(state))
  };
}

/**
 * Normalize saved or imported JSON into { state, theme }.
 * @returns {{ state: object, theme?: string } | null}
 */
export function unpackPersistPayload(raw) {
  if (!raw || typeof raw !== 'object') return null;

  if (raw.version >= PERSIST_VERSION && raw.state && typeof raw.state === 'object') {
    return { state: raw.state, theme: raw.theme };
  }

  if (raw.state && typeof raw.state === 'object') {
    return { state: raw.state, theme: raw.theme };
  }

  if (Array.isArray(raw.columns)) {
    return { state: raw, theme: raw.theme };
  }

  return null;
}

/**
 * @returns {{ ok: true, state: object, theme?: string } | { ok: false, error: string }}
 */
export function validateImportPayload(data) {
  if (!data || typeof data !== 'object') {
    return { ok: false, error: 'Неверный формат' };
  }

  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return { ok: false, error: 'Ошибка чтения файла' };
  }

  if (serialized.length > MAX_IMPORT_BYTES) {
    return { ok: false, error: 'Файл слишком большой' };
  }

  const unpacked = unpackPersistPayload(data);
  if (!unpacked?.state) {
    return { ok: false, error: 'Неверный формат' };
  }

  const { state } = unpacked;
  if (!Array.isArray(state.columns)) {
    return { ok: false, error: 'Нет колонок в файле' };
  }

  if (state.columns.length > MAX_COLUMNS) {
    return { ok: false, error: 'Слишком много колонок' };
  }

  for (const col of state.columns) {
    if (!col || typeof col !== 'object' || typeof col.id !== 'string') {
      return { ok: false, error: 'Некорректная колонка' };
    }
    if (!Array.isArray(col.tasks) || !Array.isArray(col.completed)) {
      return { ok: false, error: 'Некорректные задачи в колонке' };
    }
  }

  return { ok: true, state, theme: unpacked.theme };
}
