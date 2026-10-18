/** Custom notification sounds from settings (pomodoro, deadline reminders). */

import { normalizeSoundVolume } from './sound-volume.js';

/** @type {HTMLAudioElement | null} */
let activeAudio = null;

function toAudioSrc(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';
  if (/^(https?:|file:|data:|blob:)/i.test(filePath)) return filePath;
  const normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('/')) return `file://${normalized}`;
  return `file:///${normalized}`;
}

export function stopAllAppSounds() {
  if (!activeAudio) return;
  try {
    activeAudio.pause();
    activeAudio.currentTime = 0;
  } catch {
    /* ignore */
  }
  activeAudio = null;
}

/**
 * @param {string} filePath
 * @param {number} [volume] 0–1
 */
export function playSoundFile(filePath, volume = 0.85) {
  if (!filePath) return;
  stopAllAppSounds();
  try {
    const audio = new Audio(toAudioSrc(filePath));
    audio.volume = Math.min(1, Math.max(0, volume));
    const clear = () => {
      if (activeAudio === audio) activeAudio = null;
    };
    audio.addEventListener('ended', clear);
    audio.addEventListener('error', clear);
    activeAudio = audio;
    void audio.play();
  } catch (e) {
    console.warn('app sound', e);
    activeAudio = null;
  }
}

function soundVolume(appSettings) {
  return normalizeSoundVolume(appSettings?.pomSoundVolume);
}

/**
 * @param {'workEnd'|'breakEnd'} kind
 * @param {object} appSettings
 */
export function playPomodoroSound(kind, appSettings) {
  const s = appSettings || {};
  const filePath =
    kind === 'workEnd' ? s.pomSoundWorkEnd : kind === 'breakEnd' ? s.pomSoundBreakEnd : '';
  playSoundFile(filePath, soundVolume(s));
}

/** @param {object} appSettings */
export function playDeadlineReminderSound(appSettings) {
  playSoundFile(appSettings?.deadlineReminderSound, soundVolume(appSettings));
}
