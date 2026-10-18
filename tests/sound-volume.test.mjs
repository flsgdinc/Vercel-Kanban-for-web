import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSoundVolume, soundVolumePercent } from '../src/js/kanban/sound-volume.js';

describe('sound volume settings', () => {
  it('preserves a zero playback volume', () => {
    assert.equal(normalizeSoundVolume(0), 0);
  });

  it('uses 85 percent for a non-numeric setting', () => {
    assert.equal(soundVolumePercent(undefined), 85);
  });
});