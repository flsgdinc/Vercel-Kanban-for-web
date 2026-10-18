/** Persist / restore active pomodoro timer across app restarts. */

let persistCallback = null;
let persistTimer = null;

export function bindPomodoroStatePersistence(fn) {
  persistCallback = fn;
}

export function clearPomodoroStatePersistence() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  persistCallback = null;
}

/**
 * @param {() => object | null} exportFn
 */
export function schedulePomodoroPersist(exportFn) {
  if (!persistCallback) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try {
      persistCallback(exportFn());
    } catch (e) {
      console.error('pomodoro persist', e);
    }
  }, 350);
}

export function flushPomodoroPersist(exportFn) {
  if (!persistCallback) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  persistCallback(exportFn());
}
