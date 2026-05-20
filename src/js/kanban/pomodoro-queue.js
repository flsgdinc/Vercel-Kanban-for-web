import { state } from '../state.js';
import { hasPomodoro, normalizePomodoro, todayDateStr, getPomodoroSettings } from './pomodoro-utils.js';
import { findTask } from './task-find.js';
import { matchesFilter } from './filters.js';

export function ensurePomodoroState(s = state) {
  if (!Array.isArray(s.pomodoroQueue)) s.pomodoroQueue = [];
  if (!s.pomodoroDay || typeof s.pomodoroDay !== 'object') {
    s.pomodoroDay = { date: todayDateStr(), globalCount: 0 };
  }
  const today = todayDateStr();
  if (s.pomodoroDay.date !== today) {
    s.pomodoroDay = { date: today, globalCount: 0 };
  }
}

export function enqueuePomodoroTask(taskId, s = state) {
  ensurePomodoroState(s);
  if (!taskId || s.pomodoroQueue.includes(taskId)) return;
  s.pomodoroQueue.push(taskId);
}

export function dequeuePomodoroTask(taskId, s = state) {
  ensurePomodoroState(s);
  s.pomodoroQueue = s.pomodoroQueue.filter((id) => id !== taskId);
}

export function setTaskPomodoro(task, patch, s = state) {
  const prev = normalizePomodoro(task.pomodoro);
  const next = normalizePomodoro({ ...prev, ...patch });
  task.pomodoro = next;
  if (hasPomodoro(task)) enqueuePomodoroTask(task.id, s);
  else dequeuePomodoroTask(task.id, s);
}

export function clearTaskPomodoro(task, s = state) {
  task.pomodoro = null;          // или undefined
  dequeuePomodoroTask(task.id, s);
}

/** Убрать из очереди несуществующие / без стикера; добавить пропущенные. */
export function syncPomodoroQueue(s = state) {
  ensurePomodoroState(s);
  const valid = new Set();
  for (const col of s.columns || []) {
    for (const t of col.tasks || []) {
      if (t.completed) continue;
      if (hasPomodoro(t)) {
        valid.add(t.id);
        if (!s.pomodoroQueue.includes(t.id)) s.pomodoroQueue.push(t.id);
      }
      if (t.pomodoro) t.pomodoro = normalizePomodoro(t.pomodoro);
    }
  }
  s.pomodoroQueue = s.pomodoroQueue.filter((id) => valid.has(id));
}

export function findColumnTitle(taskId, s = state) {
  for (const c of s.columns || []) {
    if (c.tasks.some((t) => t.id === taskId)) return c.title || '';
  }
  return '';
}

/**
 * @param {(t: object) => boolean} [filterFn]
 * @returns {{ task: object, colTitle: string }[]}
 */
export function getPomodoroQueueEntries(s = state, filterFn) {
  ensurePomodoroState(s);
  const settings = getPomodoroSettings(s.appSettings);
  const useFilter = settings.pomUseBoardFilters !== false;
  const match = filterFn || (useFilter ? matchesFilter : () => true);
  const out = [];
  for (const id of s.pomodoroQueue) {
    const task = findTask(id);
    if (!task || task.completed || !hasPomodoro(task)) continue;
    if (!match(task)) continue;
    out.push({ task, colTitle: findColumnTitle(id, s) });
  }
  return out;
}

export function reorderPomodoroQueue(fromId, toId, s = state) {
  ensurePomodoroState(s);
  const q = s.pomodoroQueue;
  const from = q.indexOf(fromId);
  const to = q.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return false;
  const [m] = q.splice(from, 1);
  q.splice(to, 0, m);
  return true;
}

export function incrementPomodoroGlobal(s = state) {
  ensurePomodoroState(s);
  s.pomodoroDay.globalCount = (s.pomodoroDay.globalCount || 0) + 1;
  return s.pomodoroDay.globalCount;
}
