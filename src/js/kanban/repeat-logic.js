/** Полноценно заданное повторение (для «дни недели» нужен хотя бы один день). */
export function isRepeatConfigured(t) {
  const r = t?.repeat;
  if (!r?.every) return false;
  if (r.unit === 'weekdays') return Array.isArray(r.weekdays) && r.weekdays.length > 0;
  return true;
}

const HM_PARSE = /^(\d{1,2}):(\d{2})$/;

/** HH:MM из ISO-поля с возможным временем после T */
function hmFromIsoWithTime(isoLike) {
  if (!isoLike || typeof isoLike !== 'string' || !isoLike.includes('T')) return null;
  const m = isoLike.split('T')[1].match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}` : null;
}

/**
 * Время слота повтора для календаря и новых итераций:
 * явное repeat.time из модалки, иначе из дедлайна, иначе из repeat.start с T, иначе 10:00.
 */
export function repeatSlotHm(task) {
  const rt = task?.repeat?.time?.trim?.();
  if (rt && HM_PARSE.test(rt)) {
    const m = rt.match(HM_PARSE);
    return `${m[1].padStart(2, '0')}:${m[2]}`;
  }
  return hmFromIsoWithTime(task?.deadline) || hmFromIsoWithTime(task?.repeat?.start) || '10:00';
}

/** Хвост "THH:MM" для склейки с датой в дедлайне. */
export function repeatDeadlineTimeTail(task) {
  return `T${repeatSlotHm(task)}`;
}

/** @param {Date} d */
export function localISODate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** Серия «дни недели»: шаг every — по 7-дневным периодам от даты начала. */
export function occursOnWeekdayRepeat(r, dateStr) {
  if (!r.weekdays?.length) return false;
  const p = dateStr.split('-').map(Number);
  const target = new Date(p[0], p[1] - 1, p[2]);
  const start = new Date(r.start + 'T00:00:00');
  if (target < start) return false;
  if (r.end && target > new Date(r.end + 'T00:00:00')) return false;
  if (!r.weekdays.includes(target.getDay())) return false;
  const diffDays = Math.round((target - start) / 86400000);
  const weekIdx = Math.floor(diffDays / 7);
  return weekIdx % r.every === 0;
}

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

/**
 * Дедлайн для UI: при повторении сохранённый дедлайн (в т.ч. просроченный) до выполнения.
 * Ближайший слот считается только если дедлайн ещё не задан.
 */
export function getDisplayDeadlineIso(task) {
  if (!task) return '';
  if (!isRepeatConfigured(task)) return task.deadline || '';

  const r = task.repeat;
  const tp = repeatDeadlineTimeTail(task);
  const existing = extractIsoDate(task.deadline);
  const fullExisting = task.deadline
    ? task.deadline.includes('T')
      ? task.deadline
      : existing
        ? existing + tp
        : ''
    : '';

  if (existing && fullExisting) return fullExisting;

  const todayStr = localISODate(new Date());
  const anchor = todayStr;
  let datePart = null;

  if (r.unit === 'weekdays' && r.weekdays?.length) {
    const parts = anchor.split('-').map(Number);
    let cur = new Date(parts[0], parts[1] - 1, parts[2]);
    for (let i = 0; i < 400; i++) {
      const iso = localISODate(cur);
      if (r.end && iso > r.end) break;
      if (iso >= anchor && occursOnWeekdayRepeat(r, iso)) {
        datePart = iso;
        break;
      }
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const every = Math.max(1, Number(r.every) || 1);
    const startStr = extractIsoDate(r.start) || anchor;
    let d = new Date(startStr + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return fullExisting || '';
    let guard = 0;
    while (localISODate(d) < anchor && guard < 500) {
      advanceByRepeatUnit(d, r.unit, every);
      guard++;
    }
    datePart = localISODate(d);
    if (r.end && datePart > r.end) datePart = null;
  }

  if (!datePart) return fullExisting || '';
  return datePart + tp;
}

export function findNextWeekdayOccurrence(lastDeadlineStr, r) {
  const base = (lastDeadlineStr || r.start || '').substring(0, 10);
  const parts = base.split('-').map(Number);
  let cur = new Date(parts[0], parts[1] - 1, parts[2]);
  if (Number.isNaN(cur.getTime())) cur = new Date();
  cur.setDate(cur.getDate() + 1);
  for (let i = 0; i < 400; i++) {
    const iso = localISODate(cur);
    if (r.end && iso > r.end) break;
    if (occursOnWeekdayRepeat(r, iso)) return iso;
    cur.setDate(cur.getDate() + 1);
  }
  return null;
}
