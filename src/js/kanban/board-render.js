import { deps as d } from './deps.js';
import { escapeHtml, escapeAttr } from '../html-escape.js';
import { showCompleted } from './filters.js';
import {
  clearSubDropSlot,
  renderSubtaskDropSlot,
  resolveSubtaskDrop,
  setDraggedSubSlotHeight
} from './dnd-ui.js';
import { refreshBoardPomodoroUi } from './pomodoro-timer.js';

/** @type {{ taskId: string, fromIdx: number, toIdx: number } | null} */
let lastSubtaskDrop = null;
/** Колонка с открытым inline-добавлением — переживает renderBoard */
let pendingInlineColId = null;

export function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;

  const scrollTops = new Map();
  board.querySelectorAll('.column').forEach((col) => {
    const tc = col.querySelector('.tasks-container');
    if (tc) scrollTops.set(col.dataset.id, tc.scrollTop);
  });
  const reopenInline = pendingInlineColId;

  d.ensureFocusedColumn();
  board.innerHTML = '';
  d.state.columns.forEach((col) => board.appendChild(makeColumn(col)));
  const w = document.createElement('div');
  w.className = 'add-col-wrap';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'add-col-btn';
  btn.innerHTML = `${d.icon(d.icoShapes.plus, 16, 'ico btn-ico-inv')}Колонку`;
  btn.onclick = d.addColumn;
  w.appendChild(btn);
  board.appendChild(w);

  scrollTops.forEach((top, colId) => {
    const tc = board.querySelector(`.column[data-id="${colId}"] .tasks-container`);
    if (tc) tc.scrollTop = top;
  });
  if (reopenInline) {
    requestAnimationFrame(() => addInlineTop(reopenInline));
  }
  refreshBoardPomodoroUi();
}

function makeColumn(col) {
  const el = document.createElement('div');
  el.className = 'column' + (col.id === d.state.focusedColumnId ? ' column-focused' : '');
  el.dataset.id = col.id;
  const inner = document.createElement('div');
  inner.className = 'col-inner';
  const hdr = document.createElement('div');
  hdr.className = 'column-header';
  hdr.style.background = col.color;
  const colId = escapeAttr(col.id);
  hdr.innerHTML = `<button type="button" class="column-icon-btn" onclick="event.stopPropagation();openColumnStyleModal('${colId}')" aria-label="Иконка и цвет колонки">${d.columnIconHtml(col)}</button><span class="column-title">${escapeHtml(col.title)}</span><span class="column-count">${col.tasks.length}</span><button type="button" class="column-menu-btn" onclick="openColMenu(event,'${colId}')" aria-label="Меню колонки">${d.icon(d.icoShapes.moreH, 17, 'ico')}</button>`;
  inner.appendChild(hdr);
  hdr.draggable = true;
  hdr.setAttribute('title', 'Перетащите заголовок, чтобы поменять колонки местами');
  const addTop = document.createElement('button');
  addTop.type = 'button';
  addTop.className = 'add-task-btn-top';
  addTop.innerHTML = `${d.icon(d.icoShapes.plus, 14, 'ico')}Добавить задачу`;
  addTop.onclick = (e) => {
    e.stopPropagation();
    addInlineTop(col.id);
  };
  inner.appendChild(addTop);
  const tc2 = document.createElement('div');
  tc2.className = 'tasks-container';
  const tinner = document.createElement('div');
  tinner.className = 'tasks-inner';
  const al = document.createElement('div');
  al.className = 'task-list';
  al.dataset.column = col.id;
  col.tasks.forEach((t) => {
    const card = makeCard(t);
    if (!d.matchesFilter(t)) card.classList.add('hidden');
    al.appendChild(card);
  });
  if (!col.tasks.length && !(showCompleted && col.completed?.length)) {
    const empty = document.createElement('div');
    empty.className = 'col-empty-hint';
    empty.innerHTML = '<p>Пока пусто</p><span>Перетащите карточку сюда или нажмите «Добавить задачу»</span>';
    al.appendChild(empty);
  }
  tinner.appendChild(al);
  if (showCompleted && col.completed.length > 0) {
    const cs = document.createElement('div');
    cs.className = 'completed-section';
    const ch = document.createElement('div');
    ch.className = `completed-header ${col.compOpen ? 'expanded' : ''}`;
    ch.innerHTML = `<span class="completed-h-l">${d.icon(d.icoShapes.check, 14, 'ico ico-done-h')}${d.icon(d.icoShapes.chevronDown, 12, 'ico ico-chv')}<span class="completed-h-txt">Выполнено (${col.completed.length})</span></span>`;
    ch.onclick = () => {
      col.compOpen = !col.compOpen;
      d.saveStateNoHistory();
      renderBoard();
    };
    const cl = document.createElement('div');
    cl.className = `completed-list ${col.compOpen ? 'open' : ''}`;
    col.completed.forEach((t) => cl.appendChild(makeCard(t)));
    cs.appendChild(ch);
    cs.appendChild(cl);
    tinner.appendChild(cs);
  }
  tc2.appendChild(tinner);
  inner.appendChild(tc2);
  el.appendChild(inner);
  return el;
}

function makeCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.dataset.id = task.id;
  card.style.borderLeftColor = task.color || 'var(--border)';
  card.draggable = true;
  const sub = task.subtasks || [];
  const done = sub.filter((s) => s.done).length;
  const total = sub.length;
  const hasSubs = sub.length > 0;
  const showSubBlock = hasSubs || task.expanded;
  const row = document.createElement('div');
  row.className = 'task-main-row';
  const cb = document.createElement('div');
  cb.className = 'task-checkbox' + (task.completed ? ' checked' : '');
  cb.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!task.completed) {
      card.classList.add('anim-out');
      setTimeout(() => d.toggleDone(task.id), 200);
    } else {
      d.toggleDone(task.id);
    }
  });
  row.appendChild(cb);
  const info = document.createElement('div');
  info.className = 'task-info';
  const ttl = document.createElement('div');
  ttl.className = 'task-title' + (task.completed ? ' done' : '');
  ttl.textContent = task.title || 'Новая задача';
  ttl.addEventListener('mousedown', (e) => e.stopPropagation());
  ttl.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    d.startInlineTitleEdit(task, ttl, card);
  });
  info.appendChild(ttl);
  const sRow = document.createElement('div');
  sRow.className = 'sticker-row';
  if (task.priority) {
    const s = document.createElement('span');
    s.className = `sticker pri pri-${task.priority}`;
    s.innerHTML = '<span class="pri-bars"><i></i><i></i><i></i></span>';
    s.title = ({ low: 'Низкий', medium: 'Средний', high: 'Высокий' }[task.priority] || '');
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      d.editSticker(e, task, 'priority');
    });
    sRow.appendChild(s);
  }
  if (task.volume) {
    const s = document.createElement('span');
    s.className = 'sticker vol sticker-ich';
    s.innerHTML = `${d.icon(d.icoShapes.package, 12, 'ico sk-i')}<span>${escapeHtml(task.volume)}</span>`;
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      d.editSticker(e, task, 'volume');
    });
    sRow.appendChild(s);
  }
  if (d.hasPomodoro(task)) {
    const s = document.createElement('span');
    s.className = 'sticker pom sticker-ich';
    s.innerHTML = `${d.icon(d.icoShapes.timer, 12, 'ico sk-i')}<span>${escapeHtml(d.pomodoroLabel(task.pomodoro))}</span>`;
    s.title = 'Помодоро — клик: изменить';
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      d.editSticker(e, task, 'pomodoro');
    });
    s.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      d.launchPomodoroForTask(task.id);
    });
    sRow.appendChild(s);
  }
  const displayDeadline = d.getDisplayDeadlineIso(task);
  if (displayDeadline) {
    const st = d.deadlineStatus(displayDeadline);
    const s = document.createElement('span');
    s.className = 'sticker deadline sticker-ich' + (st === 'overdue' ? ' overdue' : st === 'soon' ? ' soon' : '');
    s.innerHTML = `${d.icon(d.icoShapes.calendarDot, 12, 'ico sk-i')}<span>${escapeHtml(d.deadlineLabel(displayDeadline))}</span>`;
    s.title = d.isRepeatConfigured(task) ? 'Следующий дедлайн по регулярности' : '';
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      d.editSticker(e, task, 'deadline');
    });
    sRow.appendChild(s);
  }
  if (d.isRepeatConfigured(task)) {
    const s = document.createElement('span');
    s.className = 'sticker repeat sticker-ich';
    s.innerHTML = d.icon(d.icoShapes.rotateCcw, 12, 'ico sk-i');
    s.title = d.repeatLabel(task.repeat);
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      d.editSticker(e, task, 'repeat');
    });
    sRow.appendChild(s);
  }
  const missing = d.getMissingStickers(task);
  if (missing.length > 0) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sticker-add-btn';
    addBtn.innerHTML = d.icon(d.icoShapes.plus, 14, 'ico');
    addBtn.title = 'Добавить стикер';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      d.showStickerMenu(e, task);
    });
    sRow.appendChild(addBtn);
  }
  info.appendChild(sRow);
  if (total > 0) {
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.innerHTML = `<div class="task-progress-bar-wrap"><div class="task-progress-bar"><div class="task-progress-bar-fill" style="width:${Math.round((done / total) * 100)}%"></div></div><span class="task-progress-text">${done}/${total}</span></div>`;
    info.appendChild(meta);
  }
  row.appendChild(info);
  let arr = null;
  if (showSubBlock) {
    arr = document.createElement('span');
    arr.className = 'expand-arrow' + (task.expanded ? ' open' : '');
    arr.innerHTML = d.icon(d.icoShapes.chevronRight, 12, 'ico exp-ico');
    row.appendChild(arr);
  }
  const mb = document.createElement('button');
  mb.type = 'button';
  mb.className = 'task-menu-btn';
  mb.setAttribute('aria-label', 'Меню');
  mb.innerHTML = d.icon(d.icoShapes.moreH, 16, 'ico');
  mb.addEventListener('mousedown', (e) => e.stopPropagation());
  mb.addEventListener('click', (e) => {
    e.stopPropagation();
    d.openTaskMenu(e, task.id);
  });
  row.appendChild(mb);
  row.addEventListener('click', (e) => {
    if (
      cb.contains(e.target) ||
      mb.contains(e.target) ||
      e.target.closest('.sticker') ||
      e.target.closest('.sticker-add-btn')
    )
      return;
    if (hasSubs) {
      task.expanded = !task.expanded;
      d.saveStateNoHistory();
      if (arr) arr.className = 'expand-arrow' + (task.expanded ? ' open' : '');
      const dropEl = card.querySelector('.subtasks-dropdown');
      if (dropEl) dropEl.className = 'subtasks-dropdown' + (task.expanded ? ' open' : '');
    }
    d.openPanel(task.id);
  });
  card.appendChild(row);

  let drop = null;
  if (!showSubBlock) return card;

  drop = document.createElement('div');
  drop.className = 'subtasks-dropdown' + (task.expanded ? ' open' : '');
  sub.forEach((st, idx) => {
    const r2 = document.createElement('div');
    r2.className = 'subtask-row';
    r2.dataset.idx = idx;
    const handle = document.createElement('span');
    handle.className = 'sub-drag-handle';
    handle.draggable = true;
    handle.title = 'Перетащить для смены порядка';
    handle.innerHTML = d.icon(d.icoShapes.grip, 12, 'ico');
    handle.addEventListener('mousedown', (e) => e.stopPropagation());
    handle.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      d.setDraggedSub(idx, task.id);
      lastSubtaskDrop = { taskId: task.id, fromIdx: idx, toIdx: idx };
      setDraggedSubSlotHeight(r2.offsetHeight);
      r2.classList.add('sub-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `${task.id}:${idx}`);
    });
    handle.addEventListener('dragend', (e) => {
      e.stopPropagation();
      r2.classList.remove('sub-dragging');
      clearSubDropSlot();
      d.clearDraggedSub();
      lastSubtaskDrop = null;
    });
    r2.appendChild(handle);
    const sc = document.createElement('div');
    sc.className = 'sub-checkbox' + (st.done ? ' checked' : '');
    sc.addEventListener('click', (e) => {
      e.stopPropagation();
      d.pushHistory();
      st.done = !st.done;
      d.saveStateNoHistory();
      sc.className = 'sub-checkbox' + (st.done ? ' checked' : '');
      const tEl = r2.querySelector('.subtask-title');
      if (tEl) tEl.className = 'subtask-title' + (st.done ? ' done' : '');
      const nd = sub.filter((s) => s.done).length;
      const f = card.querySelector('.task-progress-bar-fill');
      const tx = card.querySelector('.task-progress-text');
      if (f) f.style.width = Math.round((nd / total) * 100) + '%';
      if (tx) tx.textContent = `${nd}/${total}`;
    });
    const sp = document.createElement('span');
    sp.className = 'subtask-title' + (st.done ? ' done' : '');
    sp.textContent = st.title;
    sp.title = 'Нажмите, чтобы переименовать';
    sp.addEventListener('mousedown', (e) => e.stopPropagation());
    sp.addEventListener('click', (e) => {
      e.stopPropagation();
      d.startInlineSubtaskTitleEdit(task, st, sp);
    });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'subtask-del-btn';
    delBtn.setAttribute('aria-label', 'Удалить подзадачу');
    delBtn.title = 'Удалить';
    delBtn.innerHTML = d.icon(d.icoShapes.x, 13, 'ico');
    delBtn.addEventListener('mousedown', (e) => e.stopPropagation());
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      d.pushHistory();
      if (st?.id != null) task.subtasks = task.subtasks.filter((s) => s.id !== st.id);
      else task.subtasks.splice(idx, 1);
      d.saveStateNoHistory();
      renderBoard();
    });
    r2.appendChild(sc);
    r2.appendChild(sp);
    r2.appendChild(delBtn);
    drop.appendChild(r2);
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const { draggedSubIdx, draggedSubTaskId } = d.getDraggedSub();
    if (draggedSubTaskId !== task.id || draggedSubIdx === null) return;
    const pos = resolveSubtaskDrop(drop, e.clientY);
    lastSubtaskDrop = { taskId: task.id, fromIdx: draggedSubIdx, toIdx: pos.index };
    renderSubtaskDropSlot(drop, pos);
  });
  drop.addEventListener('dragleave', (e) => {
    if (!drop.contains(e.relatedTarget)) clearSubDropSlot();
  });
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    clearSubDropSlot();
    const { draggedSubIdx, draggedSubTaskId } = d.getDraggedSub();
    const target = lastSubtaskDrop;
    if (
      draggedSubTaskId === task.id &&
      draggedSubIdx !== null &&
      target?.taskId === task.id &&
      target.fromIdx !== target.toIdx
    ) {
      d.pushHistory();
      const subs = task.subtasks;
      const [moved] = subs.splice(target.fromIdx, 1);
      subs.splice(target.toIdx, 0, moved);
      d.saveStateNoHistory();
      renderBoard();
    }
    d.clearDraggedSub();
    lastSubtaskDrop = null;
  });
  const ar = document.createElement('div');
  ar.className = 'add-subtask-inline';
  const ai = document.createElement('input');
  ai.type = 'text';
  ai.placeholder = '+ Новая подзадача...';
  ai.addEventListener('click', (e) => e.stopPropagation());
  const doAdd = () => {
    const v = ai.value.trim();
    if (v) {
      d.pushHistory();
      task.subtasks = task.subtasks || [];
      task.subtasks.push({ id: Date.now().toString(), title: v, done: false });
      d.saveStateNoHistory();
      renderBoard();
    }
  };
  ai.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') doAdd();
    if (e.key === 'Escape') {
      ai.value = '';
      ai.blur();
    }
  });
  const ob = document.createElement('button');
  ob.textContent = 'OK';
  ob.addEventListener('click', (e) => {
    e.stopPropagation();
    doAdd();
  });
  ar.appendChild(ai);
  ar.appendChild(ob);
  drop.appendChild(ar);
  card.appendChild(drop);
  return card;
}

export function expandSubtasksBlock(id) {
  const t = d.findTask(id);
  if (!t) return;
  d.closeMenu();
  t.expanded = true;
  d.saveStateNoHistory();
  renderBoard();
}

export function addInlineTop(colId) {
  pendingInlineColId = colId;
  const colEl = document.querySelector(`.column[data-id="${colId}"]`);
  if (!colEl || colEl.querySelector('.add-task-inline')) return;
  const addBtn = colEl.querySelector('.add-task-btn-top');
  const inline = document.createElement('div');
  inline.className = 'add-task-inline anim-in';
  inline.innerHTML = `<input type="text" placeholder="Название задачи..."><button type="button">Добавить</button><button type="button" class="cancel-btn" aria-label="Отмена">${d.icon(d.icoShapes.x, 15, 'ico')}</button>`;
  addBtn.parentNode.insertBefore(inline, addBtn.nextSibling);
  addBtn.style.display = 'none';
  const inp = inline.querySelector('input');
  inp.focus();
  const finishInline = () => {
    pendingInlineColId = null;
    inline.remove();
    addBtn.style.display = 'flex';
  };
  const commit = () => {
    const v = inp.value.trim();
    finishInline();
    if (v) {
      d.pushHistory();
      const col = d.state.columns.find((c) => c.id === colId);
      if (col) {
        const newTask = {
          id: Date.now().toString(),
          title: v,
          priority: '',
          color: '',
          subtasks: [],
          completed: false,
          deadline: '',
          deadlineReminder: '',
          expanded: false,
          repeat: null,
          volume: '',
          description: ''
        };
        col.tasks.unshift(newTask);
        d.saveStateNoHistory();
        renderBoard();
        setTimeout(
          () => document.querySelector(`.task-card[data-id="${newTask.id}"]`)?.classList.add('anim-in'),
          10
        );
      }
    }
  };
  inline.querySelector('button:first-of-type').onclick = commit;
  inline.querySelector('.cancel-btn').onclick = finishInline;
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      inline.remove();
      addBtn.style.display = 'flex';
    }
  });
}
