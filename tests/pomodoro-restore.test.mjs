import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRestoredTimer } from '../src/js/kanban/pomodoro-restore.js';

describe('resolveRestoredTimer', () => {
  it('restores an already paused timer with its saved remaining time', () => {
    assert.deepEqual(
      resolveRestoredTimer({ pausedRemainingMs: 1200, endsAt: 5000 }, 4000),
      { mode: 'paused', remainingMs: 1200, endsAt: null }
    );
  });

  it('pauses a timer saved while running using the save-time remainder, regardless of now', () => {
    const session = { endsAt: 5000, savedAt: 3000 };
    const expected = { mode: 'paused', remainingMs: 2000, endsAt: null };

    assert.deepEqual(resolveRestoredTimer(session, 2500), expected);
    assert.deepEqual(resolveRestoredTimer(session, 9000), expected);
  });

  it('keeps a legacy timer running when it has no savedAt and has not expired', () => {
    assert.deepEqual(
      resolveRestoredTimer({ endsAt: 5000 }, 4000),
      { mode: 'running', remainingMs: 1000, endsAt: 5000 }
    );
  });

  it('expires a legacy timer whose endsAt is in the past', () => {
    assert.deepEqual(
      resolveRestoredTimer({ endsAt: 3000 }, 4000),
      { mode: 'expired', remainingMs: 0, endsAt: 3000 }
    );
  });

  it('expires a session whose endsAt is not after savedAt', () => {
    assert.deepEqual(
      resolveRestoredTimer({ endsAt: 3000, savedAt: 3000 }, 2000),
      { mode: 'expired', remainingMs: 0, endsAt: 3000 }
    );
  });
});