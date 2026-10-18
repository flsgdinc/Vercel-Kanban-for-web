export function normalizeSoundVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return 0.85;
  return Math.min(1, Math.max(0, volume));
}

export function soundVolumePercent(value) {
  const volume = Number(value);
  return Number.isFinite(volume) ? Math.round(volume * 100) : 85;
}