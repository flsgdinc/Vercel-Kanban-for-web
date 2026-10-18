import { sanitizeTaskPomodoroField } from './pomodoro-utils.js';
import { syncPomodoroQueue, ensurePomodoroState } from './pomodoro-queue.js';

/** Дополняет состояние после загрузки старых дампов. */
export function migrateAndNormalizeState(s) {
  if (!Array.isArray(s.archive)) s.archive = [];
  if (!Array.isArray(s.taskTemplates)) s.taskTemplates = [];
  for (const tpl of s.taskTemplates) {
    if (tpl.snapshot && !tpl.task) {
      tpl.task = tpl.snapshot;
      delete tpl.snapshot;
    }
  }
  if (Array.isArray(s.columns)) {
    for (const c of s.columns) {
      if (!c || typeof c !== 'object') continue;
      if (typeof c.icon !== 'string' || !c.icon.trim()) c.icon = 'pack:cog';
      for (const t of [...(c.tasks || []), ...(c.completed || [])]) {
        if (t) sanitizeTaskPomodoroField(t);
      }
    }
  }
  if (!s.appSettings || typeof s.appSettings !== 'object') {
    s.appSettings = { closeToTray: true, showSaveFlash: true, calendarUseBoardFilters: true };
  } else {
    if (typeof s.appSettings.closeToTray !== 'boolean') s.appSettings.closeToTray = true;
    if (typeof s.appSettings.showSaveFlash !== 'boolean') s.appSettings.showSaveFlash = true;
    if (typeof s.appSettings.calendarUseBoardFilters !== 'boolean') s.appSettings.calendarUseBoardFilters = true;
  }
  const d = s.appSettings;
  if (d.pomShortBreakMin == null) d.pomShortBreakMin = 5;
  if (d.pomLongBreakMin == null) d.pomLongBreakMin = 15;
  if (d.pomLongBreakEvery == null) d.pomLongBreakEvery = 4;
  if (typeof d.pomAutoStartBreak !== 'boolean') d.pomAutoStartBreak = false;
  if (typeof d.pomAutoStartNext !== 'boolean') d.pomAutoStartNext = false;
  if (typeof d.pomUseBoardFilters !== 'boolean') d.pomUseBoardFilters = true;
  if (d.pomSoundWorkEnd != null && typeof d.pomSoundWorkEnd !== 'string') delete d.pomSoundWorkEnd;
  if (d.pomSoundBreakEnd != null && typeof d.pomSoundBreakEnd !== 'string') delete d.pomSoundBreakEnd;
  if (d.deadlineReminderSound != null && typeof d.deadlineReminderSound !== 'string') delete d.deadlineReminderSound;
  if (d.pomSoundVolume != null) {
    const v = Number(d.pomSoundVolume);
    d.pomSoundVolume = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.85;
  }
  if (s.pomodoroSession != null && typeof s.pomodoroSession !== 'object') s.pomodoroSession = null;
  ensurePomodoroState(s);
  syncPomodoroQueue(s);
}
