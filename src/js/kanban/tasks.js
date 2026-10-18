import { state } from '../state.js';
import { saveStateNoHistory } from '../storage.js';
import { pushHistory } from './history.js';
import { isRepeatConfigured, findNextWeekdayOccurrence, repeatDeadlineTimeTail, localISODate } from './repeat-logic.js';
import { run } from './runtime.js';
import { onTaskRemovedFromActive } from './pomodoro-hooks.js';
import { resortColumnTasksIfNeeded } from './task-sort.js';

export { findTask } from './task-find.js';

function extractIsoDate(s) {
  const m = String(s || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function advanceByRepeatUnit(d, unit, every) {
  if (unit === 'days') d.setDate(d.getDate() + every);
  else if (unit === 'weeks') d.setDate(d.getDate() + every * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + every);
  else d.setDate(d.getDate() + every);
}

export function createNextIteration(task, col) {
  const r = task.repeat;
  if (!isRepeatConfigured(task)) return;
  const every = Math.max(1, Number(r.every) || 1);
  const todayStr = localISODate(new Date());
  /** Следующий слот от даты дедлайна этой итерации (или repeat.start), а не от «сегодня» — иначе просрочка сдвигает серию на дату закрытия. */
  const rawBase = extractIsoDate(task.deadline) || extractIsoDate(r.start);
  const baseDateStr = rawBase || todayStr;
  if (!baseDateStr) return;
  const next = JSON.parse(JSON.stringify(task));
  next.id = Date.now().toString();
  next.completed = false;
  next.expanded = false;
  next.subtasks = (task.subtasks || []).map((s) => ({ ...s, done: false }));
  const tp = repeatDeadlineTimeTail(task);
  let datePart;
  if (r.unit === 'weekdays' && r.weekdays?.length) {
    datePart = findNextWeekdayOccurrence(baseDateStr, r);
    if (!datePart) return;
    if (datePart <= baseDateStr) {
      datePart = findNextWeekdayOccurrence(datePart, r);
      if (!datePart || datePart <= baseDateStr) return;
    }
  } else {
    const dlDate = new Date(baseDateStr + 'T00:00:00');
    if (Number.isNaN(dlDate.getTime())) return;
    advanceByRepeatUnit(dlDate, r.unit, every);
    datePart = localISODate(dlDate);
    let guard = 0;
    while (datePart <= baseDateStr && guard < 12) {
      advanceByRepeatUnit(dlDate, r.unit, every);
      datePart = localISODate(dlDate);
      guard++;
    }
    if (datePart <= baseDateStr) return;
  }
  const duplicate = [...col.tasks, ...col.completed].some(
    (t) => t._spawnedFromTaskId === task.id && extractIsoDate(t.deadline) === datePart
  );
  if (duplicate) return;
  const selfSameDay = extractIsoDate(task.deadline) === datePart;
  if (selfSameDay) return;
  next.deadline = datePart + tp;
  if (next.repeat) {
    if (r.unit === 'weekdays') next.repeat.start = r.start;
    else next.repeat.start = datePart;
  }
  /** Связка с родителем: при возвратe из «Выполнено» без этой связи остаются лишние копии. */
  next._spawnedFromTaskId = task.id;
  col.tasks.unshift(next);
  resortColumnTasksIfNeeded(col);
}

export function toggleDone(id) {
  pushHistory();
  state.columns.forEach((col) => {
    const i = col.tasks.findIndex((t) => t.id === id);
    if (i > -1) {
      const [t] = col.tasks.splice(i, 1);
      t.completed = true;
      onTaskRemovedFromActive(id);
      if (isRepeatConfigured(t)) createNextIteration(t, col);
      col.completed.unshift(t);
      return;
    }
    const j = col.completed.findIndex((t) => t.id === id);
    if (j > -1) {
      const [t] = col.completed.splice(j, 1);
      t.completed = false;
      col.tasks = col.tasks.filter((nt) => nt._spawnedFromTaskId !== t.id);
      col.completed = col.completed.filter((nt) => nt._spawnedFromTaskId !== t.id);
      col.tasks.unshift(t);
      resortColumnTasksIfNeeded(col);
    }
  });
  saveStateNoHistory();
  run.refreshAll();
}
