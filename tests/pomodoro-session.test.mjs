import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  bindPomodoroStatePersistence,
  clearPomodoroStatePersistence,
  schedulePomodoroPersist
} from '../src/js/kanban/pomodoro-session.js';

describe('pomodoro session persistence', () => {
  it('persists during continuous scheduling', (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let persistCount = 0;
    bindPomodoroStatePersistence(() => {
      persistCount += 1;
    });

    try {
      for (let elapsed = 0; elapsed < 5000; elapsed += 250) {
        schedulePomodoroPersist(() => ({ phase: 'work' }));
        t.mock.timers.tick(250);
      }

      assert.ok(persistCount > 0, 'persistence callback should run while scheduling continues');
    } finally {
      clearPomodoroStatePersistence();
    }
  });
});