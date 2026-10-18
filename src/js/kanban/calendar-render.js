import { deps as d } from './deps.js';
import { escapeHtml, escapeAttr } from '../html-escape.js';
import { run } from './runtime.js';

export function renderCalendar() {
  if (!d.state.calYear) d.state.calYear = new Date().getFullYear();
  if (d.state.calMonth === undefined) d.state.calMonth = new Date().getMonth();
  const y = d.state.calYear;
  const m = d.state.calMonth;
  let monthName = fmtMonthYear(y, m);
  if (d.state.calView === 'week') {
    const dates = getWeekDates(d.state.calWeekOffset || 0);
    const d1 = new Date(dates[0]);
    const d2 = new Date(dates[6]);
    if (d1.getMonth() === d2.getMonth()) monthName = fmtMonthYear(d1.getFullYear(), d1.getMonth());
    else monthName = `${d1.toLocaleString('ru', { month: 'long' })} — ${fmtMonthYear(d2.getFullYear(), d2.getMonth())}`;
  }
  if (d.state.calView === 'agenda') {
    const ad = parseISODateLocal(getAgendaDate());
    monthName = ad
      .toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      .replace(/\s*г\.?$/, '');
  }
  monthName = monthName.replace(/\s*г\.?$/, '');
  const cal = document.getElementById('calendar');
  const filtHint =
    d.state.appSettings?.calendarUseBoardFilters !== false
      ? `<span class="cal-filter-hint" title="Совпадает с панелью «Фильтры» и поиском"><span class="cal-hint-ico">${d.icon(d.icoShapes.sliders, 13, 'ico')}</span>Как на доске</span>`
      : '<span class="cal-filter-hint cal-filter-hint-off" title="Включите в Настройках">Все задачи в календаре</span>';
  cal.innerHTML = `<div class="cal-top"><div class="cal-nav"><button type="button" class="cal-nav-btn" onclick="calNav(-1)" aria-label="Назад">${d.icon(d.icoShapes.chevronLeft, 17, 'ico')}</button><button type="button" class="cal-nav-btn" onclick="calNav(1)" aria-label="Вперёд">${d.icon(d.icoShapes.chevronRight, 17, 'ico')}</button></div><div class="cal-month-label">${escapeHtml(monthName)}</div><div class="cal-view-switch"><button type="button" class="cal-view-btn ${d.state.calView === 'month' ? 'active' : ''}" data-view="month" onclick="setCalView('month')">Месяц</button><button type="button" class="cal-view-btn ${d.state.calView === 'week' ? 'active' : ''}" data-view="week" onclick="setCalView('week')">Неделя</button><button type="button" class="cal-view-btn ${d.state.calView === 'agenda' ? 'active' : ''}" data-view="agenda" onclick="setCalView('agenda')">Агенда</button></div>${filtHint}</div><div class="cal-body"><div class="cal-grid-wrap" id="calGridWrap"><div class="calendar-weekdays" id="calWeekdays"></div><div id="calGrid" class="calendar-grid"></div></div><div class="cal-tasks-panel"><h4 id="calPanelTitle" class="cal-panel-head"></h4><div id="dayTasks"></div></div></div>`;
  cal.classList.remove('cal-agenda-mode', 'cal-week-mode', 'cal-month-mode');
  if (d.state.calView === 'agenda') cal.classList.add('cal-agenda-mode');
  else if (d.state.calView === 'week') cal.classList.add('cal-week-mode');
  else cal.classList.add('cal-month-mode');
  if (d.state.calView === 'agenda') renderAgenda();
  else renderCalGrid();
  renderCalendarPanel();
}

function renderCalGrid() {
  const grid = document.getElementById('calGrid');
  const weekdays = document.getElementById('calWeekdays');
  if (!grid || !weekdays) return;
  grid.innerHTML = '';
  weekdays.innerHTML = '';
  ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].forEach((day) => {
    const el = document.createElement('div');
    el.className = 'calendar-weekday';
    el.textContent = day;
    weekdays.appendChild(el);
  });
  const today = new Date();
  let dates = [];
  if (d.state.calView === 'week') {
    dates = getWeekDates(d.state.calWeekOffset || 0);
  } else {
    let dow = new Date(d.state.calYear, d.state.calMonth, 1).getDay();
    dow = dow === 0 ? 6 : dow - 1;
    const days = new Date(d.state.calYear, d.state.calMonth + 1, 0).getDate();
    for (let i = 0; i < dow; i++) dates.push(null);
    for (let day = 1; day <= days; day++)
      dates.push(
        `${d.state.calYear}-${String(d.state.calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      );
    while (dates.length < 42) dates.push(null);
  }
  dates.forEach((ds) => {
    if (!ds) {
      const empty = document.createElement('div');
      empty.className = 'calendar-day empty';
      grid.appendChild(empty);
      return;
    }
    const dNum = parseInt(ds.split('-')[2], 10);
    const el = document.createElement('div');
    el.className = 'calendar-day';
    el.dataset.date = ds;
    if (localDateStr(today) === ds) el.classList.add('today');
    if (d.state.selectedDate === ds) el.classList.add('selected');
    let tasks = d.allTasksOnDate(ds);
    if (d.state.calView === 'week' || d.state.calView === 'month') tasks = sortCalTasksByDeadline(tasks, ds);
    let tasksHTML = '';
    if (tasks.length > 0) {
      tasksHTML = '<div class="day-tasks-list">';
      tasks.slice(0, 3).forEach((t) => {
        let timeStr = '';
        if (t.deadline)
          try {
            timeStr = new Date(t.deadline).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
          } catch (_) {}
        const doneClass = t.completed ? ' done-task' : '';
        const tid = escapeAttr(t.id);
        tasksHTML += `<div class="day-task-mini${doneClass}" data-id="${tid}" draggable="true" style="border-left-color:${t.completed ? '#94a3b8' : d.PDOTS[t.priority] || 'var(--border)'}">${timeStr ? `<span class="day-task-time">${escapeHtml(timeStr)}</span>` : ''}<span class="day-task-name">${escapeHtml(t.title)}</span></div>`;
      });
      if (tasks.length > 3) tasksHTML += `<div class="day-more">+${tasks.length - 3} ещё</div>`;
      tasksHTML += '</div>';
    }
    el.innerHTML = `<div class="day-header"><span class="day-num">${dNum}</span></div>${tasksHTML || '<div class="cal-day-empty">Нет задач</div>'}`;
    el.onclick = () => selectDate(ds);
    el.querySelectorAll('.day-task-mini').forEach((mini) => {
      mini.onclick = (e) => {
        e.stopPropagation();
        d.switchView('board');
        d.highlightTask(mini.dataset.id);
      };
      if (!mini.classList.contains('done-task')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'cal-mini-done';
        b.title = 'Готово';
        b.innerHTML = d.icon(d.icoShapes.check, 11, 'ico ico-cal-mini');
        b.onclick = (e) => {
          e.stopPropagation();
          d.toggleDone(mini.dataset.id);
        };
        mini.insertBefore(b, mini.firstChild);
      }
    });
    grid.appendChild(el);
  });
}

function agendaTimelineMinutes(task, ds) {
  if (task?.deadline && task.deadline.substring(0, 10) === ds && !task.deadline.includes('T')) return null;
  const ms = d.calendarDaySortMomentMs(task, ds);
  if (!Number.isFinite(ms) || ms === Infinity) return null;
  const dt = new Date(ms);
  return dt.getHours() * 60 + dt.getMinutes();
}

function agendaFormatTime(ms) {
  if (!Number.isFinite(ms) || ms === Infinity) return '';
  try {
    return new Date(ms).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
}

function buildAgendaSubtasksBlock(liveTask, snapshotSubs) {
  const subs = liveTask?.subtasks || snapshotSubs || [];
  if (!subs.length) return null;
  const subsWrap = document.createElement('div');
  subsWrap.className = 'agenda-slot-subs';
  subsWrap.addEventListener('click', (e) => e.stopPropagation());
  subs.forEach((st, subIdx) => {
    const row = document.createElement('div');
    row.className = 'agenda-slot-sub' + (st.done ? ' done' : '');
    const sc = document.createElement('div');
    sc.className = 'agenda-slot-subchk' + (st.done ? ' done' : '');
    if (st.done) sc.innerHTML = d.icon(d.icoShapes.check, 8, 'ico ico-on-success');
    sc.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!liveTask) return;
      const ls = liveTask.subtasks?.find((s) => s.id === st.id);
      if (!ls) return;
      d.pushHistory();
      ls.done = !ls.done;
      d.saveStateNoHistory();
      run.refreshAll();
    });
    const stitle = document.createElement('span');
    stitle.textContent = st.title;
    if (liveTask?.subtasks) {
      const ls = st?.id != null ? liveTask.subtasks.find((s) => s.id === st.id) : liveTask.subtasks[subIdx];
      if (ls) {
        stitle.className = 'agenda-slot-subtitle';
        stitle.title = 'Нажмите, чтобы переименовать';
        stitle.addEventListener('mousedown', (e) => e.stopPropagation());
        stitle.addEventListener('click', (e) => {
          e.stopPropagation();
          d.startInlineSubtaskTitleEdit(liveTask, ls, stitle, () => run.refreshAll());
        });
      }
    }
    row.appendChild(sc);
    row.appendChild(stitle);
    if (liveTask?.subtasks) {
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'agenda-sub-del';
      del.title = 'Удалить';
      del.setAttribute('aria-label', 'Удалить подзадачу');
      del.innerHTML = d.icon(d.icoShapes.x, 12, 'ico');
      del.addEventListener('mousedown', (e) => e.stopPropagation());
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!liveTask.subtasks) return;
        d.pushHistory();
        if (st?.id != null) liveTask.subtasks = liveTask.subtasks.filter((s) => s.id !== st.id);
        else liveTask.subtasks.splice(subIdx, 1);
        d.saveStateNoHistory();
        run.refreshAll();
      });
      row.appendChild(del);
    }
    subsWrap.appendChild(row);
  });
  return subsWrap;
}

function fillAgendaTaskCard(inner, t, ds, showTime) {
  const liveTask = d.findTask(t.id);
  const ms = d.calendarDaySortMomentMs(t, ds);
  const head = document.createElement('div');
  head.className = 'agenda-slot-head';
  const cb = document.createElement('div');
  cb.className = 'agenda-slot-check';
  if (t.completed) cb.innerHTML = d.icon(d.icoShapes.check, 10, 'ico ico-on-success');
  cb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (liveTask) d.toggleDone(liveTask.id);
  });
  head.appendChild(cb);
  if (showTime) {
    const timeEl = document.createElement('div');
    timeEl.className = 'agenda-slot-time';
    timeEl.textContent = agendaFormatTime(ms) || '—';
    head.appendChild(timeEl);
  }
  const title = document.createElement('div');
  title.className = 'agenda-slot-title' + (t.completed ? ' done' : '');
  title.textContent = t.title;
  head.appendChild(title);
  inner.appendChild(head);
  const col = document.createElement('div');
  col.className = 'agenda-slot-col';
  col.textContent = t._col || '';
  inner.appendChild(col);
  const subsEl = buildAgendaSubtasksBlock(liveTask, t.subtasks);
  if (subsEl) inner.appendChild(subsEl);
  inner.addEventListener('click', () => {
    d.switchView('board');
    d.highlightTask(t.id);
  });
}

function renderAgenda() {
  const wrap = document.getElementById('calGridWrap');
  if (!wrap) return;
  const ds = getAgendaDate();
  let tasks = d.allTasksOnDate(ds);
  tasks = sortCalTasksByDeadline(tasks, ds);
  const dt = parseISODateLocal(ds);
  const dayTitle = dt.toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });
  const layout = document.createElement('div');
  layout.className = 'agenda-layout agenda-list';
  let doneMain = 0;
  let subDone = 0;
  let subTotal = 0;
  tasks.forEach((t) => {
    if (t.completed) doneMain++;
    const live = d.findTask(t.id);
    const sx = live?.subtasks || t.subtasks || [];
    sx.forEach((st) => {
      subTotal++;
      if (st.done) subDone++;
    });
  });
  const totalMain = tasks.length;
  const pctMain = totalMain ? Math.round((100 * doneMain) / totalMain) : 0;
  const prog = document.createElement('div');
  prog.className = 'agenda-progress-block';
  const row = document.createElement('div');
  row.className = 'agenda-progress-row';
  row.innerHTML = `<span>Прогресс дня</span><span class="agenda-progress-meta">${doneMain} / ${totalMain}</span>`;
  prog.appendChild(row);
  const bar = document.createElement('div');
  bar.className = 'agenda-progress-bar';
  const fill = document.createElement('div');
  fill.className = 'agenda-progress-fill';
  fill.style.width = pctMain + '%';
  bar.appendChild(fill);
  prog.appendChild(bar);
  if (subTotal > 0) {
    const sl = document.createElement('div');
    sl.className = 'agenda-progress-subline';
    sl.textContent = `Подзадачи: ${subDone} / ${subTotal}`;
    prog.appendChild(sl);
  }
  layout.appendChild(prog);
  const ttl = document.createElement('div');
  ttl.className = 'agenda-day-title';
  ttl.textContent = dayTitle;
  layout.appendChild(ttl);
  if (!tasks.length) {
    const hint = document.createElement('p');
    hint.className = 'agenda-empty-hint';
    hint.textContent = 'На этот день нет задач. Добавьте их справа или на доске.';
    layout.appendChild(hint);
    wrap.innerHTML = '';
    wrap.appendChild(layout);
    return;
  }
  const untimed = [];
  const timed = [];
  tasks.forEach((t) => {
    const min = agendaTimelineMinutes(t, ds);
    if (min === null) untimed.push(t);
    else timed.push({ t, m: min });
  });
  timed.sort(
    (a, b) =>
      a.m - b.m ||
      d.calendarDaySortMomentMs(a.t, ds) - d.calendarDaySortMomentMs(b.t, ds) ||
      String(a.t.id).localeCompare(String(b.t.id))
  );
  if (untimed.length) {
    const u = document.createElement('div');
    u.className = 'agenda-untimed';
    const ul = document.createElement('div');
    ul.className = 'agenda-untimed-label';
    ul.textContent = 'Без времени';
    u.appendChild(ul);
    untimed.forEach((t) => {
      const shell = document.createElement('div');
      shell.className = 'agenda-slot-static' + (t.completed ? ' done' : '');
      const inner = document.createElement('div');
      inner.className = 'agenda-slot-inner';
      inner.style.borderLeftColor = t.completed ? '#94a3b8' : d.PDOTS[t.priority] || 'var(--border)';
      inner.style.marginBottom = '6px';
      fillAgendaTaskCard(inner, t, ds, false);
      shell.appendChild(inner);
      u.appendChild(shell);
    });
    layout.appendChild(u);
  }
  if (timed.length) {
    const timedScroll = document.createElement('div');
    timedScroll.className = 'agenda-timed-scroll';
    const timedList = document.createElement('div');
    timedList.className = 'agenda-timed-list';
    timed.forEach(({ t }) => {
      const shell = document.createElement('div');
      shell.className = 'agenda-timed-item' + (t.completed ? ' done' : '');
      const inner = document.createElement('div');
      inner.className = 'agenda-slot-inner';
      inner.style.borderLeftColor = t.completed ? '#94a3b8' : d.PDOTS[t.priority] || 'var(--border)';
      fillAgendaTaskCard(inner, t, ds, true);
      shell.appendChild(inner);
      timedList.appendChild(shell);
    });
    timedScroll.appendChild(timedList);
    layout.appendChild(timedScroll);
  }
  wrap.innerHTML = '';
  wrap.appendChild(layout);
}

export function calNav(dir) {
  if (d.state.calView === 'agenda') {
    const parts = getAgendaDate().split('-').map(Number);
    const cur = new Date(parts[0], parts[1] - 1, parts[2]);
    cur.setDate(cur.getDate() + dir);
    d.state.agendaDate = localDateStr(cur);
    d.state.selectedDate = d.state.agendaDate;
    d.state.calYear = cur.getFullYear();
    d.state.calMonth = cur.getMonth();
  } else if (d.state.calView === 'week') {
    d.state.calWeekOffset = (d.state.calWeekOffset || 0) + dir;
  } else {
    d.state.calMonth += dir;
    if (d.state.calMonth > 11) {
      d.state.calMonth = 0;
      d.state.calYear++;
    }
    if (d.state.calMonth < 0) {
      d.state.calMonth = 11;
      d.state.calYear--;
    }
  }
  d.saveStateNoHistory();
  renderCalendar();
}

function selectDate(ds) {
  d.state.selectedDate = ds;
  if (d.state.calView !== 'agenda') renderCalGrid();
  renderCalendarPanel();
}

export function renderCalendarPanel() {
  const container = document.getElementById('dayTasks');
  const title = document.getElementById('calPanelTitle');
  if (!container || !title) return;
  const panelDate = d.state.calView === 'agenda' ? getAgendaDate() : d.state.selectedDate;
  if (!panelDate) {
    title.textContent = 'Выберите дату';
    container.innerHTML = '<div class="cal-panel-empty"><p>Выберите день в сетке слева или откройте агенду.</p></div>';
    return;
  }
  title.innerHTML = `<span class="cal-panel-title-row">${d.icon(d.icoShapes.listTodo, 14, 'ico')}<span>${escapeHtml(panelDate)}</span></span>`;
  let tasks = d.allTasksOnDate(panelDate);
  if (d.state.calView === 'week' || d.state.calView === 'month') tasks = sortCalTasksByDeadline(tasks, panelDate);
  container.innerHTML = '';
  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'cal-panel-empty';
    empty.innerHTML =
      '<p>На этот день задач нет.</p><p class="cal-panel-hint">Добавьте задачу кнопкой ниже или перетащите из доски.</p>';
    container.appendChild(empty);
  } else {
    tasks.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'cal-task-item' + (t.completed ? ' done-item' : '');
      row.style.borderLeftColor = t.completed ? '#94a3b8' : d.PDOTS[t.priority] || 'var(--border)';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cal-task-done';
      btn.title = t.completed ? 'Вернуть в работу' : 'Выполнено';
      btn.innerHTML = t.completed
        ? d.icon(d.icoShapes.rotateCcw, 13, 'ico')
        : d.icon(d.icoShapes.check, 13, 'ico');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        d.toggleDone(t.id);
      });
      const main = document.createElement('div');
      main.className = 'cal-task-main';
      main.addEventListener('click', () => {
        d.switchView('board');
        d.highlightTask(t.id);
      });
      const nm = document.createElement('div');
      nm.className = 'cal-task-name' + (t.completed ? ' done' : '');
      nm.textContent = t.title;
      const col = document.createElement('div');
      col.className = 'cal-task-col';
      col.textContent = t._col;
      main.appendChild(nm);
      main.appendChild(col);
      row.appendChild(btn);
      row.appendChild(main);
      container.appendChild(row);
    });
  }
  const addBtn = document.createElement('button');
  addBtn.id = 'calAddBtn';
  addBtn.className = 'cal-add-btn';
  addBtn.type = 'button';
  addBtn.textContent = '+ Добавить задачу на этот день';
  addBtn.onclick = () => showCalInlineAdd(container);
  container.appendChild(addBtn);
}

function showCalInlineAdd(container) {
  const row = document.createElement('div');
  row.className = 'cal-new-task-row';
  row.innerHTML = `<input type="text" placeholder="Название задачи..." /><div class="cal-btns"><button type="button" class="cal-btn-save">Добавить</button><button type="button" class="cal-btn-cancel" aria-label="Отмена">${d.icon(d.icoShapes.x, 15, 'ico')}</button></div>`;
  const prev = container.querySelector('.cal-add-btn');
  if (prev) prev.remove();
  container.appendChild(row);
  const input = row.querySelector('input');
  input.focus();
  const dayISO = d.state.calView === 'agenda' ? getAgendaDate() : d.state.selectedDate;
  const finish = () => renderCalendarPanel();
  const createTask = () => {
    const title = input.value.trim();
    if (!title) return;
    d.pushHistory();
    const targetCol = d.state.columns.find((c) => c.title === 'В работе') || d.state.columns[0];
    const newTask = {
      id: Date.now().toString(),
      title,
      priority: '',
      color: '',
      subtasks: [],
      deadline: dayISO + 'T10:00',
      deadlineReminder: '',
      completed: false,
      expanded: false,
      repeat: null,
      volume: '',
      description: ''
    };
    if (targetCol) targetCol.tasks.unshift(newTask);
    d.saveStateNoHistory();
    run.refreshAll();
  };
  row.querySelector('.cal-btn-save').onclick = createTask;
  row.querySelector('.cal-btn-cancel').onclick = finish;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') createTask();
    if (e.key === 'Escape') finish();
  };
}

export function localDateStr(dt) {
  const y = dt.getFullYear();
  const mo = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function getAgendaDate() {
  if (d.state.agendaDate) return d.state.agendaDate;
  return localDateStr(new Date());
}

function parseISODateLocal(iso) {
  const p = iso.split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function getMondayOf(dt) {
  const day = dt.getDay();
  const daysSinceMon = day === 0 ? 6 : day - 1;
  const mon = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  mon.setDate(mon.getDate() - daysSinceMon);
  return mon;
}

function getWeekDates(offset = 0) {
  const anchorISO = d.state.weekAnchorISO || d.state.selectedDate || localDateStr(new Date());
  const mon = getMondayOf(parseISODateLocal(anchorISO));
  mon.setDate(mon.getDate() + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    return localDateStr(dd);
  });
}

function fmtMonthYear(y, m) {
  return new Date(y, m, 1).toLocaleString('ru', { month: 'long', year: 'numeric' }).replace(/\s*г\.?$/, '');
}

function sortCalTasksByDeadline(tasks, dateStr) {
  return [...tasks].sort((a, b) => {
    const ka = d.calendarDaySortMomentMs(a, dateStr);
    const kb = d.calendarDaySortMomentMs(b, dateStr);
    if (ka !== kb) return ka - kb;
    const cmp = (a.title || '').localeCompare(b.title || '', 'ru');
    if (cmp !== 0) return cmp;
    return String(a.id).localeCompare(String(b.id));
  });
}
