const { contextBridge, ipcRenderer } = require('electron');

// Защита от атак
const removeDangerousGlobals = () => {
  delete window.require;
  delete window.module;
  delete window.exports;
  delete window.__dirname;
  delete window.__filename;
};

removeDangerousGlobals();

// Безопасное exposed API
contextBridge.exposeInMainWorld('electronAPI', {
  // Сохранение состояния
  saveState: (data) => ipcRenderer.invoke('save-state', data),
  
  // Загрузка состояния  
  loadState: () => ipcRenderer.invoke('load-state'),
  
  // Работа с файлами
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),
  openFile: () => ipcRenderer.invoke('open-file'),
  
  // Управление окном
  minimize: () => ipcRenderer.invoke('minimize'),
  maximize: () => ipcRenderer.invoke('maximize'),
  close: () => ipcRenderer.invoke('close'),

  /** Системное уведомление (тост Windows / центр уведомлений) */
  showNotification: (opts) => ipcRenderer.invoke('show-notification', opts),

  /** true = закрытие окна сворачивает в трей; false = выход из приложения */
  setCloseBehavior: (closeToTray) => ipcRenderer.invoke('set-close-behavior', closeToTray),

  supabaseLoadConfig: () => ipcRenderer.invoke('supabase-load-config'),
  supabaseSaveConfig: (config) => ipcRenderer.invoke('supabase-save-config', config),
  supabaseLoadSession: () => ipcRenderer.invoke('supabase-load-session'),
  supabaseSaveSession: (session) => ipcRenderer.invoke('supabase-save-session', session),

  /** slot: 'work' | 'break' | 'deadline' — копирует mp3/wav в профиль, возвращает путь */
  pickSoundFile: (slot) => ipcRenderer.invoke('pick-sound-file', { slot }),

  /** Подписка на остановку звука оповещения (клик по toast / фокус окна). Возвращает функцию отписки. */
  onStopNotificationSounds: (callback) => {
    if (typeof callback !== 'function') return () => {};
    const handler = () => callback();
    ipcRenderer.on('stop-notification-sounds', handler);
    return () => ipcRenderer.removeListener('stop-notification-sounds', handler);
  }
});

// Защита от инъекций
window.addEventListener('DOMContentLoaded', () => {
  removeDangerousGlobals();
});