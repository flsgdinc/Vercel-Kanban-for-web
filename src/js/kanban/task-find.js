import { state } from '../state.js';

export function findTask(id) {
  for (const c of state.columns) {
    const t = c.tasks.find((t) => t.id === id) || c.completed.find((t) => t.id === id);
    if (t) return t;
  }
  return null;
}
