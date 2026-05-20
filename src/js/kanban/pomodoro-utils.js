/** @typedef {{ count?: number, val?: number, unit?: string, done?: number }} PomodoroMeta */

const DEFAULT_POM = { count: 1, val: 25, unit: 'min', done: 0 };

export function getPomodoroSettings(appSettings) {
  const s = appSettings || {};
  return {
    shortBreakMin: Math.max(1, Math.min(60, Number(s.pomShortBreakMin) || 5)),
    longBreakMin: Math.max(1, Math.min(90, Number(s.pomLongBreakMin) || 15)),
    longBreakEvery: Math.max(2, Math.min(12, Number(s.pomLongBreakEvery) || 4)),
    autoStartBreak: !!s.pomAutoStartBreak,
    autoStartNext: !!s.pomAutoStartNext,
    pomUseBoardFilters: s.pomUseBoardFilters !== false
  };
}

/** Нормализация после старых дампов { val, unit } без count. */
export function normalizePomodoro(p) {
  // Если нет объекта — значит, помодоро не задано
  if (!p || typeof p !== 'object') return null;

  const val = Math.max(1, Math.min(180, parseInt(p.val, 10) || 25));
  const unit = p.unit === 'h' ? 'h' : 'min';
  let count = parseInt(p.count, 10);
  if (!Number.isFinite(count) || count < 1) {
    // Старый формат: val мог означать «кол-во» без отдельного поля — если unit есть, val = длительность
    count = 1;
  }
  count = Math.max(1, Math.min(99, count));
  let done = parseInt(p.done, 10);
  if (!Number.isFinite(done) || done < 0) done = 0;
  if (done > count) done = count;
  return { count, val, unit, done };
}

export function hasPomodoro(task) {
  const raw = task?.pomodoro;
  if (!raw || typeof raw !== 'object') return false;
  const val = parseInt(raw.val, 10);
  const count = parseInt(raw.count, 10);
  if (Number.isFinite(val) && val > 0 && Number.isFinite(count) && count > 0) return true;
  // Старый формат без count: только val + unit
  if (Number.isFinite(val) && val > 0 && (raw.count == null || raw.count === '')) return true;
  return false;
}

export function pomodoroDurationMs(p) {
  const n = normalizePomodoro(p);
  if (!n) return 0;
  return n.unit === 'h' ? n.val * 3600000 : n.val * 60000;
}

export function pomodoroUnitLabel(unit) {
  return unit === 'h' ? 'ч' : 'м';
}

/** «3×25м» или «2/3×25м» */
export function pomodoroLabel(p, opts = {}) {
  const n = normalizePomodoro(p);
  if (!n) return '';
  const u = pomodoroUnitLabel(n.unit);
  const dur = `${n.val}${u}`;
  if (opts.short) return `${n.count}×${dur}`;
  if (n.done > 0) return `${n.done}/${n.count}×${dur}`;
  return `${n.count}×${dur}`;
}

export function pomodoroPlanComplete(p) {
  const n = normalizePomodoro(p);
  if (!n) return false;
  return n.done >= n.count;
}

export function formatTimerMs(ms) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function todayDateStr(d = new Date()) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}