import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  addTaskToColumn,
  completeTask,
  uncompleteTask
} from '../lib/task-mutations.js';

export function BoardScreen({
  state,
  status,
  statusError,
  onRefresh,
  onSignOut,
  onChange
}) {
  const columns = state.columns || [];
  const [columnId, setColumnId] = useState(() => columns[0]?.id || '');
  const [newTitle, setNewTitle] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!columns.length) return;
    if (!columns.some((c) => c.id === columnId)) {
      setColumnId(columns[0].id);
    }
  }, [columns, columnId]);

  const column = useMemo(
    () => columns.find((c) => c.id === columnId) || columns[0],
    [columns, columnId]
  );

  const activeTasks = column?.tasks || [];
  const doneTasks = column?.completed || [];

  const applyChange = async (mutator) => {
    setSaving(true);
    try {
      const next = mutator(state);
      await onChange(next);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !column) return;
    const title = newTitle;
    setNewTitle('');
    void applyChange((s) => addTaskToColumn(s, column.id, title));
  };

  const toggleTask = (task) => {
    if (task.completed) {
      void applyChange((s) => uncompleteTask(s, task.id));
    } else {
      void applyChange((s) => completeTask(s, task.id));
    }
  };

  return (
    <div class="shell board-shell">
      <header class="board-header">
        <div>
          <h1>Kanban</h1>
          <p class={`status small ${statusError ? 'error' : ''}`}>{status}</p>
        </div>
        <div class="header-actions">
          <button
            type="button"
            class="btn icon"
            title="Обновить из облака"
            disabled={saving}
            onClick={onRefresh}
          >
            ↻
          </button>
          <button type="button" class="btn icon ghost" title="Выйти" onClick={onSignOut}>
            ⎋
          </button>
        </div>
      </header>

      <label class="field compact">
        <span>Колонка</span>
        <select
          value={column?.id || ''}
          onChange={(e) => setColumnId(e.currentTarget.value)}
        >
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} ({c.tasks.length})
            </option>
          ))}
        </select>
      </label>

      <ul class="task-list" aria-busy={saving}>
        {activeTasks.length === 0 ? (
          <li class="empty muted">Нет активных задач</li>
        ) : (
          activeTasks.map((t) => (
            <li key={t.id} class="task-row">
              <button
                type="button"
                class="check"
                aria-label="Выполнить"
                disabled={saving}
                onClick={() => toggleTask(t)}
              />
              <span class="task-title">{t.title}</span>
            </li>
          ))
        )}
      </ul>

      {doneTasks.length > 0 ? (
        <section class="done-section">
          <button
            type="button"
            class="done-toggle"
            onClick={() => setShowCompleted((v) => !v)}
          >
            Выполненные ({doneTasks.length}) {showCompleted ? '▾' : '▸'}
          </button>
          {showCompleted ? (
            <ul class="task-list done">
              {doneTasks.map((t) => (
                <li key={t.id} class="task-row done">
                  <button
                    type="button"
                    class="check checked"
                    aria-label="Вернуть в работу"
                    disabled={saving}
                    onClick={() => toggleTask({ ...t, completed: true })}
                  />
                  <span class="task-title">{t.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <form class="add-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="Новая задача…"
          value={newTitle}
          disabled={saving || !column}
          onInput={(e) => setNewTitle(e.currentTarget.value)}
        />
        <button type="submit" class="btn primary" disabled={saving || !newTitle.trim()}>
          +
        </button>
      </form>
    </div>
  );
}
