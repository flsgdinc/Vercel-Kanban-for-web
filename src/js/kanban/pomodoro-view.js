import { icon, shapes as icoShapes } from '../icons.js';
import {
  pomodoroLabel,
  pomodoroPlanComplete,
  normalizePomodoro,
  getPomodoroSettings,
  pomodoroDurationMs
} from './pomodoro-utils.js';
import { getPomodoroQueueEntries, ensurePomodoroState } from './pomodoro-queue.js';
import {
  getPomodoroPhase,
  getPomodoroTaskId,
  getTimerDisplay,
  getPhaseLabel,
  getRemainingMs,
  isPomodoroRunning,
  isPomodoroPaused
} from './pomodoro-timer.js';
import { state } from '../state.js';

let selectedPomTaskId = null;
let draggedPomId = null;

export function getSelectedPomodoroTaskId() {
  return selectedPomTaskId;
}

export function setSelectedPomodoroTaskId(id) {
  selectedPomTaskId = id;
}

/** Лёгкое обновление цифр таймера без перерисовки очереди */
export function updatePomodoroTimerUi() {
  const root = document.getElementById('pomodoro');
  if (!root?.classList.contains('active')) return;
  const digits = root.querySelector('.pom-timer-digits');
  if (digits) digits.textContent = getTimerDisplay();
  const phaseEl = root.querySelector('.pom-phase-label');
  if (phaseEl) phaseEl.textContent = getPhaseLabel();
  const selTask = selectedPomTaskId;
  const activeId = getPomodoroTaskId();
  const phase = getPomodoroPhase();
  root.querySelectorAll('.pom-queue-item').forEach((row) => {
    const id = row.dataset.id;
    row.classList.toggle('pom-running', id === activeId && phase !== 'idle');
  });
  if (!selTask) return;
  const entry = getPomodoroQueueEntries().find((e) => e.task.id === selTask);
  if (!entry) return;
  const selP = normalizePomodoro(entry.task.pomodoro);
  const totalMs = selP ? pomodoroDurationMs(selP) : 0;
  const rem = getRemainingMs();
  const running = isPomodoroRunning();
  const paused = isPomodoroPaused();
  const progress =
    phase === 'work' && totalMs > 0 && (running || paused)
      ? Math.min(100, Math.max(0, ((totalMs - rem) / totalMs) * 100))
      : phase !== 'idle' && (running || paused)
        ? 50
        : 0;
  const ring = root.querySelector('.pom-timer-ring');
  if (ring) ring.style.setProperty('--pom-progress', `${progress}%`);
}

/**
 * @param {{
 *   onStart: (id: string, force?: boolean) => void,
 *   onPause: () => void,
 *   onResume: () => void,
 *   onStop: () => void,
 *   onBreak: (kind: 'shortBreak'|'longBreak') => void,
 *   onSkipBreak: () => void,
 *   onAddMinute: () => void,
 *   onResetProgress: (id: string) => void,
 *   onReorder: (fromId: string, toId: string) => void,
 *   onOpenTask: (id: string) => void,
 *   onSelect: (id: string) => void
 * }} handlers
 */
export function renderPomodoroView(handlers) {
  const root = document.getElementById('pomodoro');
  if (!root) return;
  ensurePomodoroState(state);
  const entries = getPomodoroQueueEntries();
  const activeId = getPomodoroTaskId();
  const phase = getPomodoroPhase();
  const selected =
    selectedPomTaskId && entries.some((e) => e.task.id === selectedPomTaskId)
      ? selectedPomTaskId
      : entries[0]?.task.id || null;
  selectedPomTaskId = selected;

  const selEntry = selected ? entries.find((e) => e.task.id === selected) : null;
  const selTask = selEntry?.task || null;
  const selP = selTask ? normalizePomodoro(selTask.pomodoro) : null;
  const running = isPomodoroRunning();
  const paused = isPomodoroPaused();
  const isActiveOnSelected = activeId === selected && phase !== 'idle';
  const totalMs = selP ? pomodoroDurationMs(selP) : 25 * 60000;
  const rem = getRemainingMs();
  const progress =
    phase === 'work' && totalMs > 0 && (running || paused)
      ? Math.min(100, Math.max(0, ((totalMs - rem) / totalMs) * 100))
      : phase !== 'idle' && (running || paused)
        ? 50
        : 0;

  const settings = getPomodoroSettings(state.appSettings);
  const dayCount = state.pomodoroDay?.globalCount || 0;

  let queueHtml = '';
  if (!entries.length) {
    queueHtml = `<div class="pom-empty">Нет задач с помодоро. Добавьте стикер на карточке.</div>`;
  } else {
    queueHtml = entries
      .map(({ task, colTitle }) => {
        const p = normalizePomodoro(task.pomodoro);
        const done = pomodoroPlanComplete(p);
        const isSel = task.id === selected;
        const isRun = task.id === activeId && phase !== 'idle';
        return `<div class="pom-queue-item${isSel ? ' selected' : ''}${done ? ' pom-done' : ''}${isRun ? ' pom-running' : ''}" data-id="${task.id}" draggable="true">
          <span class="pom-queue-drag" title="Перетащить">${icon(icoShapes.grip, 14, 'ico')}</span>
          <div class="pom-queue-main">
            <div class="pom-queue-title">${escapeHtml(task.title || 'Без названия')}</div>
            <div class="pom-queue-meta"><span class="pom-queue-col">${escapeHtml(colTitle)}</span><span class="pom-queue-badge">${pomodoroLabel(p)}</span></div>
          </div>
          <button type="button" class="pom-queue-play" data-play="${task.id}" title="Запустить">${icon(icoShapes.play, 16, 'ico')}</button>
        </div>`;
      })
      .join('');
  }

  root.innerHTML = `<div class="pom-layout">
    <aside class="pom-queue">
      <div class="pom-queue-head">
        <h2 class="pom-queue-title-h">Очередь</h2>
        <span class="pom-queue-hint">Перетащите для порядка</span>
      </div>
      <div class="pom-queue-list" id="pomQueueList">${queueHtml}</div>
    </aside>
    <section class="pom-timer-panel">
      <div class="pom-timer-ring" style="--pom-progress:${progress}%">
        <div class="pom-timer-inner">
          <div class="pom-phase-label">${escapeHtml(getPhaseLabel())}</div>
          <div class="pom-timer-digits">${getTimerDisplay()}</div>
          <div class="pom-timer-task">${selTask ? escapeHtml(selTask.title) : 'Выберите задачу'}</div>
          ${selP ? `<div class="pom-timer-plan">${pomodoroLabel(selP)}</div>` : ''}
        </div>
      </div>
      <div class="pom-timer-actions">
        ${
          !isActiveOnSelected
            ? `<button type="button" class="pom-btn pom-btn-primary" id="pomMainStart" ${!selTask ? 'disabled' : ''}>${icon(icoShapes.play, 16, 'ico')} Старт</button>`
            : paused
              ? `<button type="button" class="pom-btn pom-btn-primary" id="pomMainResume">${icon(icoShapes.play, 16, 'ico')} Продолжить</button>`
              : `<button type="button" class="pom-btn" id="pomMainPause">${icon(icoShapes.pause, 16, 'ico')} Пауза</button>`
        }
        ${isActiveOnSelected ? `<button type="button" class="pom-btn" id="pomMainStop">${icon(icoShapes.square, 16, 'ico')} Стоп</button>` : ''}
        ${isActiveOnSelected ? `<button type="button" class="pom-btn pom-btn-ghost" id="pomAddMin">+1 мин</button>` : ''}
        ${
          phase === 'idle' && selTask && pomodoroPlanComplete(normalizePomodoro(selTask.pomodoro))
            ? `<button type="button" class="pom-btn pom-btn-ghost" id="pomForceStart">Ещё сессия</button>`
            : ''
        }
      </div>
      <div class="pom-break-row">
        <button type="button" class="pom-btn pom-btn-ghost" id="pomShortBreak" ${phase !== 'idle' ? 'disabled' : ''}>Перерыв ${settings.shortBreakMin}м</button>
        <button type="button" class="pom-btn pom-btn-ghost" id="pomLongBreak" ${phase !== 'idle' ? 'disabled' : ''}>Длинный ${settings.longBreakMin}м</button>
        ${phase === 'shortBreak' || phase === 'longBreak' ? `<button type="button" class="pom-btn pom-btn-ghost" id="pomSkipBreak">Пропустить перерыв</button>` : ''}
      </div>
      <div class="pom-stats">Сегодня: ${dayCount} помодоро · длинный каждые ${settings.longBreakEvery}</div>
      ${selTask && pomodoroPlanComplete(normalizePomodoro(selTask.pomodoro)) ? `<button type="button" class="pom-reset-progress" id="pomResetProgress">Сбросить прогресс</button>` : ''}
    </section>
  </div>`;

  const list = root.querySelector('#pomQueueList');
  if (list) wirePomodoroQueue(list, handlers);
  root.querySelector('#pomMainStart')?.addEventListener('click', () => {
    if (selected) handlers.onStart(selected, false);
  });
  root.querySelector('#pomForceStart')?.addEventListener('click', () => {
    if (selected) handlers.onStart(selected, true);
  });
  root.querySelector('#pomMainPause')?.addEventListener('click', () => handlers.onPause());
  root.querySelector('#pomMainResume')?.addEventListener('click', () => handlers.onResume());
  root.querySelector('#pomMainStop')?.addEventListener('click', () => handlers.onStop());
  root.querySelector('#pomAddMin')?.addEventListener('click', () => handlers.onAddMinute());
  root.querySelector('#pomShortBreak')?.addEventListener('click', () => handlers.onBreak('shortBreak'));
  root.querySelector('#pomLongBreak')?.addEventListener('click', () => handlers.onBreak('longBreak'));
  root.querySelector('#pomSkipBreak')?.addEventListener('click', () => handlers.onSkipBreak());
  root.querySelector('#pomResetProgress')?.addEventListener('click', () => {
    if (selected) handlers.onResetProgress(selected);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wirePomodoroQueue(list, handlers) {
  list.querySelectorAll('.pom-queue-item').forEach((row) => {
    const id = row.dataset.id;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.pom-queue-play')) return;
      handlers.onSelect(id);
    });
    row.querySelector('.pom-queue-play')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onSelect(id);
      handlers.onStart(id, false);
    });
    row.addEventListener('dblclick', (e) => {
      e.preventDefault();
      handlers.onOpenTask(id);
    });
    row.addEventListener('dragstart', (e) => {
      draggedPomId = id;
      row.classList.add('pom-dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('pom-dragging');
      list.querySelectorAll('.pom-queue-item').forEach((r) => r.classList.remove('pom-drag-over'));
      draggedPomId = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedPomId && draggedPomId !== id) row.classList.add('pom-drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('pom-drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('pom-drag-over');
      if (draggedPomId && draggedPomId !== id) {
        handlers.onReorder(draggedPomId, id);
        handlers.onSelect(draggedPomId);
      }
    });
  });
}
