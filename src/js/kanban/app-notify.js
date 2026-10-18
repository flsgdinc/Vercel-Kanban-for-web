/** Системные оповещения (Windows: центр уведомлений) + опциональный звук. */

import { playDeadlineReminderSound, stopAllAppSounds } from './pomodoro-sounds.js';

function bindWebNotificationClick(n) {
  n.onclick = () => {
    stopAllAppSounds();
    window.focus?.();
    n.close();
  };
}

/**
 * @param {{ title: string, body?: string, sound?: 'deadline' | 'none', appSettings?: object }} opts
 */
export function showAppNotification(opts) {
  const title = opts.title || 'Kanban';
  const body = opts.body || '';

  if (window.electronAPI?.showNotification) {
    void window.electronAPI.showNotification({ title, body });
  } else if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      const n = new Notification(title, { body: body || undefined });
      bindWebNotificationClick(n);
    } else if (Notification.permission !== 'denied') {
      void Notification.requestPermission().then((p) => {
        if (p === 'granted') {
          const n = new Notification(title, { body: body || undefined });
          bindWebNotificationClick(n);
        }
      });
    }
  }

  if (opts.sound === 'deadline' && opts.appSettings) {
    playDeadlineReminderSound(opts.appSettings);
  }
}
