/** Shared drag-and-drop visuals and drop-index resolution. */

let taskDropSlot = null;
let subDropSlot = null;
let draggedTaskSlotHeight = null;
let draggedSubSlotHeight = null;

export function setDraggedTaskSlotHeight(px) {
  draggedTaskSlotHeight = px > 0 ? Math.round(px) : null;
}

export function clearDraggedTaskSlotHeight() {
  draggedTaskSlotHeight = null;
}

export function setDraggedSubSlotHeight(px) {
  draggedSubSlotHeight = px > 0 ? Math.round(px) : null;
}

export function clearDraggedSubSlotHeight() {
  draggedSubSlotHeight = null;
}

function measureDraggingTaskHeight() {
  const dragging = document.querySelector('.task-card.dragging');
  if (dragging) return Math.round(dragging.offsetHeight);
  return draggedTaskSlotHeight;
}

function applyDropSlotSize(el, heightPx, fallbackMinPx) {
  if (heightPx && heightPx > 0) {
    el.style.height = `${heightPx}px`;
    el.style.minHeight = '0';
  } else {
    el.style.height = '';
    el.style.minHeight = fallbackMinPx ? `${fallbackMinPx}px` : '';
  }
}

function resetDropSlotSize(el) {
  el.style.height = '';
  el.style.minHeight = '';
}

export function getTaskListFromEvent(e) {
  const tl = e.target.closest('.task-list');
  if (tl) return tl;
  const tc = e.target.closest('.tasks-container');
  if (tc) return tc.querySelector('.task-list');
  const col = e.target.closest('.column');
  if (col) return col.querySelector('.task-list');
  return null;
}

export function getVisibleTaskCards(list) {
  return [...list.querySelectorAll('.task-card:not(.dragging):not(.hidden)')];
}

/**
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {string | null} [excludeId]
 * @returns {{ insertBefore: Element | null, index: number, beforeId: string | null }}
 */
export function resolveTaskDrop(list, clientY, excludeId = null) {
  const cards = getVisibleTaskCards(list).filter((card) => card.dataset.id !== excludeId);
  for (let i = 0; i < cards.length; i++) {
    const box = cards[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) {
      return { insertBefore: cards[i], index: i, beforeId: cards[i].dataset.id };
    }
  }
  return { insertBefore: null, index: cards.length, beforeId: null };
}

export function clearTaskDropSlot() {
  if (taskDropSlot) {
    resetDropSlotSize(taskDropSlot);
    if (taskDropSlot.parentNode) taskDropSlot.parentNode.removeChild(taskDropSlot);
  }
  taskDropSlot = null;
  document.querySelectorAll('.task-list.dnd-active').forEach((el) => el.classList.remove('dnd-active'));
  document.querySelectorAll('.task-card.dnd-shuffle-shift').forEach((el) =>
    el.classList.remove('dnd-shuffle-shift', 'dnd-shuffle-over')
  );
}

/**
 * @param {HTMLElement} list
 * @param {{ insertBefore: Element | null, index: number }} pos
 */
export function renderTaskDropSlot(list, pos) {
  clearTaskDropSlot();
  list.classList.add('dnd-active');
  taskDropSlot = document.createElement('div');
  taskDropSlot.className = 'drop-slot drop-slot-task';
  taskDropSlot.setAttribute('aria-hidden', 'true');
  if (pos.insertBefore) list.insertBefore(taskDropSlot, pos.insertBefore);
  else list.appendChild(taskDropSlot);
  applyDropSlotSize(taskDropSlot, measureDraggingTaskHeight(), 40);

  const cards = getVisibleTaskCards(list);
  cards.forEach((card, i) => {
    card.classList.remove('dnd-shuffle-shift', 'dnd-shuffle-over');
    if (i < pos.index) card.classList.add('dnd-shuffle-shift');
    else if (i >= pos.index) card.classList.add('dnd-shuffle-over');
  });
}

export function clearSubDropSlot() {
  if (subDropSlot) {
    resetDropSlotSize(subDropSlot);
    if (subDropSlot.parentNode) subDropSlot.parentNode.removeChild(subDropSlot);
  }
  subDropSlot = null;
  document.querySelectorAll('.subtasks-dropdown.dnd-active').forEach((el) => el.classList.remove('dnd-active'));
  document.querySelectorAll('.subtask-row.dnd-shuffle-shift, .subtask-row.dnd-shuffle-over').forEach((el) =>
    el.classList.remove('dnd-shuffle-shift', 'dnd-shuffle-over', 'sub-drag-over')
  );
}

/**
 * @param {HTMLElement} container .subtasks-dropdown
 * @param {number} clientY
 */
export function resolveSubtaskDrop(container, clientY) {
  const rows = [...container.querySelectorAll('.subtask-row:not(.sub-dragging)')];
  for (let i = 0; i < rows.length; i++) {
    const box = rows[i].getBoundingClientRect();
    if (clientY < box.top + box.height / 2) {
      return { insertBefore: rows[i], index: i };
    }
  }
  return { insertBefore: null, index: rows.length };
}

export function renderSubtaskDropSlot(container, pos) {
  clearSubDropSlot();
  container.classList.add('dnd-active');
  subDropSlot = document.createElement('div');
  subDropSlot.className = 'drop-slot drop-slot-sub';
  subDropSlot.setAttribute('aria-hidden', 'true');
  if (pos.insertBefore) container.insertBefore(subDropSlot, pos.insertBefore);
  else container.appendChild(subDropSlot);
  applyDropSlotSize(subDropSlot, draggedSubSlotHeight, 28);

  const rows = [...container.querySelectorAll('.subtask-row:not(.sub-dragging)')];
  rows.forEach((row, i) => {
    row.classList.remove('dnd-shuffle-shift', 'dnd-shuffle-over', 'sub-drag-over');
    if (i < pos.index) row.classList.add('dnd-shuffle-shift');
    else if (i >= pos.index) row.classList.add('dnd-shuffle-over');
  });
}

export function clearColumnDropUi() {
  document.querySelectorAll('#board .column').forEach((c) => {
    c.classList.remove('drag-over-col', 'dnd-col-target', 'dnd-shuffle-shift', 'dnd-shuffle-over');
  });
}

/**
 * @param {HTMLElement} board
 * @param {number} clientX
 * @param {string} draggedColId
 */
export function resolveColumnDrop(board, clientX, draggedColId) {
  const cols = [...board.querySelectorAll('.column:not(.dragging-col)')].filter(
    (c) => c.dataset.id !== draggedColId
  );
  const allCols = [...board.querySelectorAll('.column')];
  for (let i = 0; i < allCols.length; i++) {
    if (allCols[i].dataset.id === draggedColId) continue;
    const box = allCols[i].getBoundingClientRect();
    if (clientX < box.left + box.width / 2) {
      return { beforeCol: allCols[i], index: i };
    }
  }
  return { beforeCol: null, index: allCols.length };
}

/**
 * @param {HTMLElement} board
 * @param {{ beforeCol: Element | null, index: number }} pos
 * @param {string} draggedColId
 */
export function renderColumnDropUi(board, pos, draggedColId) {
  clearColumnDropUi();
  const cols = [...board.querySelectorAll('.column')];
  cols.forEach((col, i) => {
    col.classList.remove('dnd-shuffle-shift', 'dnd-shuffle-over', 'dnd-col-target');
    if (col.dataset.id === draggedColId) return;
    if (i < pos.index) col.classList.add('dnd-shuffle-shift');
    else col.classList.add('dnd-shuffle-over');
  });
  if (pos.beforeCol) pos.beforeCol.classList.add('dnd-col-target');
  else {
    const last = cols[cols.length - 1];
    if (last?.dataset.id !== draggedColId) last.classList.add('dnd-col-target');
  }
}

export function clearAllDropUi() {
  clearTaskDropSlot();
  clearSubDropSlot();
  clearColumnDropUi();
  clearDraggedTaskSlotHeight();
  clearDraggedSubSlotHeight();
}
