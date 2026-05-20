import { saveStateNoHistory } from '../storage.js';
import { pushHistory } from './history.js';

export function startInlineTitleEdit(task, ttlEl, card) {
  const prevTitle = task.title || '';
  let finishing = false;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'task-title-inline-input';
  inp.value = prevTitle;
  inp.addEventListener('mousedown', (e) => e.stopPropagation());
  inp.addEventListener('click', (e) => e.stopPropagation());
  ttlEl.replaceWith(inp);
  inp.focus();
  inp.select();
  const finish = (save) => {
    if (finishing) return;
    finishing = true;
    if (save) {
      const v = inp.value.trim();
      if (v) {
        if (v !== prevTitle) {
          pushHistory();
          task.title = v;
          saveStateNoHistory();
        }
      } else {
        task.title = prevTitle;
      }
    } else {
      task.title = prevTitle;
    }
    const div = document.createElement('div');
    div.className = 'task-title' + (task.completed ? ' done' : '');
    div.textContent = task.title || 'Новая задача';
    div.addEventListener('mousedown', (e) => e.stopPropagation());
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineTitleEdit(task, div, card);
    });
    inp.replaceWith(div);
  };
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  inp.addEventListener('blur', () => finish(true));
}

/**
 * Переименование подзадачи по клику на текст (как у заголовка карточки).
 * @param {() => void} [afterSave] — например обновление календаря-агенды
 */
export function startInlineSubtaskTitleEdit(task, subtask, titleEl, afterSave) {
  const prevTitle = subtask.title || '';
  let finishing = false;
  const inp = document.createElement('input');
  inp.type = 'text';
  inp.className = 'subtask-title-inline-input';
  inp.value = prevTitle;
  inp.addEventListener('mousedown', (e) => e.stopPropagation());
  inp.addEventListener('click', (e) => e.stopPropagation());
  titleEl.replaceWith(inp);
  inp.focus();
  inp.select();
  const finish = (save) => {
    if (finishing) return;
    finishing = true;
    if (save) {
      const v = inp.value.trim();
      if (v) {
        if (v !== prevTitle) {
          pushHistory();
          subtask.title = v;
          saveStateNoHistory();
          afterSave?.();
        }
      } else {
        subtask.title = prevTitle;
      }
    } else {
      subtask.title = prevTitle;
    }
    const span = document.createElement('span');
    span.className = 'subtask-title' + (subtask.done ? ' done' : '');
    span.textContent = subtask.title || '';
    span.title = 'Нажмите, чтобы переименовать';
    span.addEventListener('mousedown', (e) => e.stopPropagation());
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineSubtaskTitleEdit(task, subtask, span, afterSave);
    });
    inp.replaceWith(span);
  };
  inp.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  inp.addEventListener('blur', () => finish(true));
}
