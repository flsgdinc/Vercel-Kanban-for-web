import { state } from '../state.js';

const FILTER_KEYS = ['priority', 'volume', 'deadline', 'pomodoroUnit'];

/** @type {Record<string, string[]>} */
export let activeFilters = {
  priority: [],
  volume: [],
  deadline: [],
  pomodoroUnit: [],
};
export let searchQuery = '';
export let showCompleted = true;

export function setSearchQuery(q) {
  searchQuery = q;
}
export function setShowCompleted(v) {
  showCompleted = v;
}

export function toggleShowCompletedFlag() {
  showCompleted = !showCompleted;
  return showCompleted;
}
export function getActiveFilters() {
  return activeFilters;
}

function normalizeFilterList(val) {
  if (val == null || val === '') return [];
  if (Array.isArray(val)) return [...new Set(val.filter(Boolean))];
  return [val];
}

export function setActiveFilters(f) {
  if (!f || typeof f !== 'object') return;
  activeFilters = {
    priority: normalizeFilterList(f.priority),
    volume: normalizeFilterList(f.volume),
    deadline: normalizeFilterList(f.deadline),
    pomodoroUnit: normalizeFilterList(f.pomodoroUnit),
  };
}

function filtersActive() {
  return FILTER_KEYS.some((k) => activeFilters[k]?.length > 0);
}

function deadlineBucketMatches(d, now, bucket) {
  if (bucket === 'overdue') return d < now;
  if (bucket === 'today') {
    const td = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return dd.getTime() === td.getTime();
  }
  if (bucket === 'week') return d.getTime() <= now.getTime() + 7 * 864e5;
  if (bucket === 'month') return d.getTime() <= now.getTime() + 30 * 864e5;
  return false;
}

/** Фильтрация карточки на доске */
export function matchesFilter(t) {
  if (searchQuery && !t.title.toLowerCase().includes(searchQuery)) return false;
  const pr = activeFilters.priority;
  if (pr.length && !pr.includes(t.priority)) return false;
  const vol = activeFilters.volume;
  if (vol.length && !vol.includes(t.volume)) return false;
  const pu = activeFilters.pomodoroUnit;
  if (pu.length && (!t.pomodoro || !pu.includes(t.pomodoro.unit))) return false;
  const dl = activeFilters.deadline;
  if (dl.length) {
    const now = new Date();
    const d = t.deadline ? new Date(t.deadline) : null;
    if (!d) return false;
    const any = dl.some((bucket) => deadlineBucketMatches(d, now, bucket));
    if (!any) return false;
  }
  return true;
}

/** Календарь: при включённой настройке — те же правила, что на доске. */
export function matchesCalendarFilter(t) {
  if (state.appSettings?.calendarUseBoardFilters === false) return true;
  return matchesFilter(t);
}

function syncFilterPanelRow(id, key) {
  document.querySelectorAll(`#${id} .filt-opt`).forEach((b) => {
    b.classList.toggle('active', activeFilters[key].includes(b.dataset.val));
  });
}

/** Подвязка панели фильтров в шапке. Несколько значений в одной группе — логика ИЛИ. */
export function setupFilterPanelUI(onFiltersChange) {
  const map = { filtPriority: 'priority', filtVolume: 'volume', filtDeadline: 'deadline', filtPomodoro: 'pomodoroUnit' };
  Object.entries(map).forEach(([id, key]) => {
    document.querySelectorAll(`#${id} .filt-opt`).forEach((btn) => {
      btn.onclick = () => {
        const val = btn.dataset.val;
        const arr = activeFilters[key];
        const i = arr.indexOf(val);
        if (i === -1) arr.push(val);
        else arr.splice(i, 1);
        onFiltersChange();
        syncFilterPanelRow(id, key);
        const fb = document.getElementById('filterBtn');
        if (fb) fb.classList.toggle('danger-active', filtersActive());
      };
    });
  });
}

export function clearAllFiltersUi(onFiltersChange) {
  activeFilters = { priority: [], volume: [], deadline: [], pomodoroUnit: [] };
  document.querySelectorAll('.filt-opt').forEach((b) => b.classList.remove('active'));
  const fb = document.getElementById('filterBtn');
  if (fb) fb.classList.remove('danger-active');
  onFiltersChange();
}
