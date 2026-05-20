import { initApp } from './kanban.js';

document.addEventListener('DOMContentLoaded', () => {
  void initApp().catch((err) => {
    console.error('initApp failed', err);
  });
});
