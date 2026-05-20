import { VOLUMES } from '../constants.js';
import { getDisplayDeadlineIso } from './repeat-logic.js';

/** @typedef {'priority' | 'deadline' | 'volume' | 'name'} TaskSortMode */

const PRIORITY_RANK = { high: 0, medium: 1, low: 2, '': 3 };
const VOLUME_RANK = Object.fromEntries(VOLUMES.map((v, i) => [v, i]));

/**
 * @param {object} task
 * @returns {string}
 */
function taskDeadlineKey(task) {
  return getDisplayDeadlineIso(task) || task.deadline || '';
}

/**
 * @param {object} a
 * @param {object} b
 * @param {TaskSortMode} mode
 */
export function compareTasks(a, b, mode) {
  if (mode === 'priority') {
    return (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
  }
  if (mode === 'deadline') {
    const da = taskDeadlineKey(a);
    const db = taskDeadlineKey(b);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  }
  if (mode === 'volume') {
    const va = a.volume || '';
    const vb = b.volume || '';
    const ra = va in VOLUME_RANK ? VOLUME_RANK[va] : VOLUMES.length;
    const rb = vb in VOLUME_RANK ? VOLUME_RANK[vb] : VOLUMES.length;
    if (ra !== rb) return ra - rb;
    return va.localeCompare(vb, 'ru');
  }
  return String(a.title || '').localeCompare(String(b.title || ''), 'ru', { sensitivity: 'base' });
}

/**
 * @param {object[]} tasks
 * @param {TaskSortMode} mode
 */
export function sortTaskList(tasks, mode) {
  tasks.sort((a, b) => compareTasks(a, b, mode));
}

/**
 * @param {{ tasks: object[], completed?: object[], sortBy?: string }} col
 * @param {TaskSortMode} mode
 */
export function sortColumnTasks(col, mode) {
  if (!col) return;
  sortTaskList(col.tasks, mode);
  if (Array.isArray(col.completed)) sortTaskList(col.completed, mode);
  col.sortBy = mode;
}

/**
 * @param {{ tasks: object[], completed?: object[] }[]} columns
 * @param {TaskSortMode} mode
 */
export function sortAllColumns(columns, mode) {
  if (!Array.isArray(columns)) return;
  columns.forEach((col) => sortColumnTasks(col, mode));
}

export const SORT_MENU_ITEMS = [
  ['priority', 'По приоритету'],
  ['deadline', 'По дедлайну'],
  ['volume', 'По объему'],
  ['name', 'По названию']
];
