import { MAX_HISTORY } from '../constants.js';
import { state, undoStack, redoStack } from '../state.js';
import { saveStateNoHistory } from '../storage.js';
import { run } from './runtime.js';

function snapshot() {
  return JSON.stringify({
    columns: JSON.parse(JSON.stringify(state.columns)),
    archive: JSON.parse(JSON.stringify(state.archive || [])),
    taskTemplates: JSON.parse(JSON.stringify(state.taskTemplates || [])),
    appSettings: JSON.parse(JSON.stringify(state.appSettings || {})),
    pomodoroQueue: JSON.parse(JSON.stringify(state.pomodoroQueue || [])),
    pomodoroDay: JSON.parse(JSON.stringify(state.pomodoroDay || { date: '', globalCount: 0 })),
    focusedColumnId: state.focusedColumnId,
    selectedDate: state.selectedDate,
    agendaDate: state.agendaDate,
    weekAnchorISO: state.weekAnchorISO,
    calYear: state.calYear,
    calMonth: state.calMonth,
    calView: state.calView,
    calWeekOffset: state.calWeekOffset
  });
}

function applySnapshot(json) {
  const snap = JSON.parse(json);
  state.columns = snap.columns;
  state.archive = snap.archive || [];
  state.taskTemplates = snap.taskTemplates || [];
  if (snap.appSettings) state.appSettings = snap.appSettings;
  if (snap.pomodoroQueue) state.pomodoroQueue = snap.pomodoroQueue;
  if (snap.pomodoroDay) state.pomodoroDay = snap.pomodoroDay;
  if ('focusedColumnId' in snap) state.focusedColumnId = snap.focusedColumnId;
  if ('selectedDate' in snap) state.selectedDate = snap.selectedDate;
  if ('agendaDate' in snap) state.agendaDate = snap.agendaDate;
  if ('weekAnchorISO' in snap) state.weekAnchorISO = snap.weekAnchorISO;
  if ('calYear' in snap) state.calYear = snap.calYear;
  if ('calMonth' in snap) state.calMonth = snap.calMonth;
  if ('calView' in snap) state.calView = snap.calView;
  if ('calWeekOffset' in snap) state.calWeekOffset = snap.calWeekOffset;
}

export function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  redoStack.length = 0;
  updateUndoRedoBtns();
}

export function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  applySnapshot(undoStack.pop());
  saveStateNoHistory();
  run.refreshAll();
  updateUndoRedoBtns();
  run.showHkHint('↩ Отменено');
}

export function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  applySnapshot(redoStack.pop());
  saveStateNoHistory();
  run.refreshAll();
  updateUndoRedoBtns();
  run.showHkHint('↪ Повторено');
}

export function updateUndoRedoBtns() {
  const u = document.getElementById('undoBtn');
  const r = document.getElementById('redoBtn');
  if (u) u.disabled = !undoStack.length;
  if (r) r.disabled = !redoStack.length;
}
