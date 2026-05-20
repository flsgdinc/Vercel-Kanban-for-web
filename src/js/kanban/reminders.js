import { deadlineLabel } from '../deadline-utils.js';
import { state } from '../state.js';

const REMINDER_MINUTES = { '5m': 5, '15m': 15, '30m': 30, '1h': 60, '3h': 180, '1d': 1440, '1w': 10080 };
const reminderFired = new Set();

function notifyKanban(title, body) {
  if (window.electronAPI?.showNotification) void window.electronAPI.showNotification({ title, body });
  else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') new Notification(title, { body });
}

function reminderStoreKey(t) {
  return `${t.id}\0${t.deadline || ''}\0${t.deadlineReminder || ''}`;
}

export function checkDeadlineReminders() {
  const now = Date.now();
  for (const col of state.columns) {
    for (const task of col.tasks) {
      if (task.completed) continue;
      if (!task.deadline || !task.deadlineReminder) continue;
      const mins = REMINDER_MINUTES[task.deadlineReminder];
      if (!mins) continue;
      const dl = new Date(task.deadline).getTime();
      if (Number.isNaN(dl)) continue;
      const remindAt = dl - mins * 60 * 1000;
      if (now < remindAt || now >= dl) continue;
      const key = reminderStoreKey(task);
      if (reminderFired.has(key)) continue;
      reminderFired.add(key);
      notifyKanban('Скоро дедлайн', `${task.title || 'Задача'} — ${deadlineLabel(task.deadline)}`);
    }
  }
}
