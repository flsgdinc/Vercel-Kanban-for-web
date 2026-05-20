import { state } from '../state.js';
import { occursOnWeekdayRepeat, repeatSlotHm } from './repeat-logic.js';
import { matchesCalendarFilter } from './filters.js';

/**
 * Момент времени задачи именно для ячейки dateStr календаря.
 * Если дедлайн на этот день — его timestamp; если попадание только по повтору — дата слота + время шаблона.
 */
export function calendarDaySortMomentMs(task, dateStr) {
  if (!dateStr || !task) return Number.POSITIVE_INFINITY;
  if (task.deadline && task.deadline.substring(0, 10) === dateStr) {
    const ms = new Date(task.deadline).getTime();
    return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
  }
  const hm = repeatSlotHm(task);
  const ms = new Date(`${dateStr}T${hm}:00`).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

export function taskOccursOn(task, dateStr) {
  if (task.deadline && task.deadline.substring(0, 10) === dateStr) return true;
  // If task has a concrete future deadline instance, it should not appear on earlier days via repeat projection.
  if (task.deadline && task.deadline.substring(0, 10) > dateStr) return false;
  // Просроченная итерация: не проецируем следующие слоты повтора, пока не выполнена.
  if (task.deadline && !task.completed && task.repeat?.every) {
    const dlDate = task.deadline.substring(0, 10);
    if (dlDate < dateStr) return false;
  }
  // Completed recurring instances should not keep "re-occurring" on future days.
  if (task.completed) return false;
  const r = task.repeat;
  if (!r?.every || !r.start) return false;
  if (r.unit === 'weekdays') return occursOnWeekdayRepeat(r, dateStr);
  const start = new Date(r.start + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');
  if (target < start) return false;
  if (r.end && target > new Date(r.end + 'T00:00:00')) return false;
  const diffDays = Math.round((target - start) / 86400000);
  if (r.unit === 'days') return diffDays % r.every === 0;
  if (r.unit === 'weeks') return diffDays % (r.every * 7) === 0;
  if (r.unit === 'months') {
    const sm = start.getMonth(),
      sy = start.getFullYear(),
      sd = start.getDate(),
      tm = target.getMonth(),
      ty = target.getFullYear(),
      td = target.getDate();
    if (td !== sd) return false;
    return ((ty - sy) * 12 + (tm - sm)) % r.every === 0;
  }
  return false;
}

export function allTasksOnDate(ds) {
  const res = [];
  state.columns.forEach((col) => {
    [...col.tasks, ...col.completed].forEach((t) => {
      if (!taskOccursOn(t, ds)) return;
      if (!matchesCalendarFilter(t)) return;
      res.push({ ...t, _col: col.title });
    });
  });
  return res;
}
