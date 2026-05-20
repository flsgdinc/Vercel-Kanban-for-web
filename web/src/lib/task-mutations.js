/**
 * @param {string} title
 */
export function createMinimalTask(title) {
  return {
    id: Date.now().toString(),
    title: title.trim(),
    priority: '',
    color: '',
    subtasks: [],
    deadline: '',
    deadlineReminder: '',
    completed: false,
    expanded: false,
    description: '',
    volume: '',
    pomodoro: {},
    repeat: null
  };
}

/**
 * @param {object} state — kanban state with columns
 * @param {string} columnId
 * @param {string} title
 */
export function addTaskToColumn(state, columnId, title) {
  const trimmed = title.trim();
  if (!trimmed) return state;

  const next = structuredClone(state);
  const col = next.columns.find((c) => c.id === columnId);
  if (!col) return state;
  col.tasks.unshift(createMinimalTask(trimmed));
  return next;
}

/**
 * Mark task done (moves to completed). Repeat spawn is desktop-only for now.
 * @param {object} state
 * @param {string} taskId
 */
export function completeTask(state, taskId) {
  const next = structuredClone(state);
  for (const col of next.columns) {
    const i = col.tasks.findIndex((t) => t.id === taskId);
    if (i === -1) continue;
    const [t] = col.tasks.splice(i, 1);
    t.completed = true;
    col.completed.unshift(t);
    return next;
  }
  return state;
}

/**
 * @param {object} state
 * @param {string} taskId
 */
export function uncompleteTask(state, taskId) {
  const next = structuredClone(state);
  for (const col of next.columns) {
    const j = col.completed.findIndex((t) => t.id === taskId);
    if (j === -1) continue;
    const [t] = col.completed.splice(j, 1);
    t.completed = false;
    col.tasks = col.tasks.filter((nt) => nt._spawnedFromTaskId !== t.id);
    col.completed = col.completed.filter((nt) => nt._spawnedFromTaskId !== t.id);
    col.tasks.unshift(t);
    return next;
  }
  return state;
}
