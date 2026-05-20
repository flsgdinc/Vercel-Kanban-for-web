import { state } from '../state.js';

let flashTimer = null;
let debounceTimer = null;

export function showSaveFlash() {
  if (state.appSettings?.showSaveFlash === false) return;
  const el = document.getElementById('saveFlash');
  if (!el) return;
  el.classList.add('show');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('show'), 1200);
}

export function scheduleSaveFlash() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => showSaveFlash(), 400);
}
