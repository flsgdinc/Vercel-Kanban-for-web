import { state } from '../state.js';
import { findTask } from './task-find.js';
import {
  formatTimerMs,
  getPomodoroSettings,
  pomodoroDurationMs,
  pomodoroPlanComplete,
  normalizePomodoro,
  todayDateStr
} from './pomodoro-utils.js';
import { incrementPomodoroGlobal, ensurePomodoroState } from './pomodoro-queue.js';

/** @type {'idle'|'work'|'shortBreak'|'longBreak'} */
let phase = 'idle';
let taskId = null;
let endsAt = null;
let pausedRemainingMs = null;
let tickTimer = null;

const listeners = new Set();
let pomHint = (msg) => {
  if (typeof window.showHkHint === 'function') window.showHkHint(msg);
};

export function onPomodoroTick(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.error(e);
    }
  });
}

export function getPomodoroPhase() {
  return phase;
}
export function getPomodoroTaskId() {
  return taskId;
}
export function isPomodoroRunning() {
  return phase !== 'idle' && endsAt != null;
}
export function isPomodoroPaused() {
  return phase !== 'idle' && endsAt == null && pausedRemainingMs != null;
}

export function getRemainingMs() {
  if (phase === 'idle') return 0;
  if (pausedRemainingMs != null) return pausedRemainingMs;
  if (!endsAt) return 0;
  return Math.max(0, endsAt - Date.now());
}

export function getPhaseLabel() {
  if (phase === 'work') return 'Работа';
  if (phase === 'shortBreak') return 'Короткий перерыв';
  if (phase === 'longBreak') return 'Длинный перерыв';
  return 'Готов';
}

function breakDurationMs(kind) {
  const s = getPomodoroSettings(state.appSettings);
  if (kind === 'longBreak') return s.longBreakMin * 60000;
  return s.shortBreakMin * 60000;
}

function pickBreakPhase() {
  ensurePomodoroState(state);
  const s = getPomodoroSettings(state.appSettings);
  const n = state.pomodoroDay.globalCount || 0;
  if (n > 0 && n % s.longBreakEvery === 0) return 'longBreak';
  return 'shortBreak';
}

function startPhase(nextPhase, durationMs, tid) {
  phase = nextPhase;
  taskId = tid || taskId;
  endsAt = Date.now() + durationMs;
  pausedRemainingMs = null;
  ensureTick();
  emit();
}

export function stopPomodoro() {
  phase = 'idle';
  taskId = null;
  endsAt = null;
  pausedRemainingMs = null;
  emit();
}

export function pausePomodoro() {
  if (phase === 'idle' || pausedRemainingMs != null) return;
  pausedRemainingMs = getRemainingMs();
  endsAt = null;
  emit();
}

export function resumePomodoro() {
  if (phase === 'idle' || pausedRemainingMs == null) return;
  endsAt = Date.now() + pausedRemainingMs;
  pausedRemainingMs = null;
  ensureTick();
  emit();
}

/** @param {boolean} [force] — старт сверх плана */
export function startPomodoroWork(id, force = false) {
  const t = findTask(id);
  if (!t || !hasPomodoroTask(t)) return false;
  const p = normalizePomodoro(t.pomodoro);
  if (!force && pomodoroPlanComplete(p)) return false;
  startPhase('work', pomodoroDurationMs(p), id);
  return true;
}

function hasPomodoroTask(t) {
  const p = normalizePomodoro(t.pomodoro);
  return p.val > 0 && p.count > 0;
}

export function startPomodoroBreak(kind) {
  const k = kind === 'longBreak' ? 'longBreak' : 'shortBreak';
  startPhase(k, breakDurationMs(k), taskId);
  return true;
}

export function skipToIdle() {
  stopPomodoro();
}

function completeWorkSession() {
  const t = taskId ? findTask(taskId) : null;
  if (t?.pomodoro) {
    const p = normalizePomodoro(t.pomodoro);
    if (p.done < p.count) t.pomodoro = { ...p, done: p.done + 1 };
  }
  incrementPomodoroGlobal(state);
  const settings = getPomodoroSettings(state.appSettings);
  const breakPh = pickBreakPhase();
  if (settings.autoStartBreak) {
    startPhase(breakPh, breakDurationMs(breakPh), taskId);
    notifyPhaseEnd('work', t);
    return;
  }
  phase = 'idle';
  endsAt = null;
  pausedRemainingMs = null;
  notifyPhaseEnd('work', t, { suggestBreak: breakPh });
  emit();
}

function completeBreakSession() {
  const tid = taskId;
  const settings = getPomodoroSettings(state.appSettings);
  notifyPhaseEnd(phase, tid ? findTask(tid) : null);
  if (settings.autoStartNext && tid) {
    const t = findTask(tid);
    if (t && !pomodoroPlanComplete(normalizePomodoro(t.pomodoro))) {
      startPomodoroWork(tid);
      return;
    }
  }
  phase = 'idle';
  endsAt = null;
  pausedRemainingMs = null;
  emit();
}

function notifyPhaseEnd(endedPhase, task, extra = {}) {
  const title =
    endedPhase === 'work'
      ? 'Помодоро завершён'
      : endedPhase === 'longBreak'
        ? 'Длинный перерыв окончен'
        : 'Перерыв окончен';
  let body = task?.title ? `«${task.title}»` : '';
  if (endedPhase === 'work' && extra.suggestBreak) {
    body = body ? `${body} — время перерыва` : 'Время перерыва';
  }
  if (window.electronAPI?.showNotification) {
    void window.electronAPI.showNotification({ title, body: body || title });
  } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body: body || undefined });
  }
  pomHint(title);
}

export function setPomodoroHint(fn) {
  pomHint = fn;
}

function onTimerEnd() {
  if (phase === 'work') completeWorkSession();
  else if (phase === 'shortBreak' || phase === 'longBreak') completeBreakSession();
}

function ensureTick() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    if (phase === 'idle') return;
    if (pausedRemainingMs != null) {
      emit();
      return;
    }
    if (endsAt && Date.now() >= endsAt) {
      onTimerEnd();
      return;
    }
    emit();
  }, 250);
}

export function getTimerDisplay() {
  return formatTimerMs(getRemainingMs());
}

export function addMinute() {
  if (phase === 'idle') return;
  if (pausedRemainingMs != null) pausedRemainingMs += 60000;
  else if (endsAt) endsAt += 60000;
  emit();
}

/** Сброс дневного счётчика при смене даты */
export function refreshPomodoroDay() {
  ensurePomodoroState(state);
  const today = todayDateStr();
  if (state.pomodoroDay.date !== today) {
    state.pomodoroDay = { date: today, globalCount: 0 };
  }
}
