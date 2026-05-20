import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isRepeatConfigured,
  occursOnWeekdayRepeat,
  repeatSlotHm,
  getDisplayDeadlineIso
} from '../src/js/kanban/repeat-logic.js';

describe('repeat-logic', () => {
  it('isRepeatConfigured requires every', () => {
    assert.equal(isRepeatConfigured({ repeat: { every: 0 } }), false);
    assert.equal(isRepeatConfigured({ repeat: { every: 1, unit: 'days' } }), true);
  });

  it('weekdays unit needs at least one day', () => {
    assert.equal(
      isRepeatConfigured({ repeat: { every: 1, unit: 'weekdays', weekdays: [] } }),
      false
    );
    assert.equal(
      isRepeatConfigured({ repeat: { every: 1, unit: 'weekdays', weekdays: [1] } }),
      true
    );
  });

  it('occursOnWeekdayRepeat matches Monday', () => {
    const r = { every: 1, unit: 'weekdays', weekdays: [1], start: '2026-05-11' };
    assert.equal(occursOnWeekdayRepeat(r, '2026-05-11'), true);
    assert.equal(occursOnWeekdayRepeat(r, '2026-05-12'), false);
  });

  it('repeatSlotHm prefers explicit time', () => {
    assert.equal(repeatSlotHm({ repeat: { time: '9:30' } }), '09:30');
  });

  it('getDisplayDeadlineIso returns next slot when repeat has no deadline', () => {
    const dl = getDisplayDeadlineIso({
      repeat: { every: 1, unit: 'days', start: '2020-01-01', time: '10:00' }
    });
    assert.match(dl, /^\d{4}-\d{2}-\d{2}T10:00/);
  });

  it('getDisplayDeadlineIso keeps overdue deadline until completed', () => {
    const dl = getDisplayDeadlineIso({
      deadline: '2020-06-01T22:00',
      repeat: { every: 1, unit: 'weeks', start: '2020-01-01', time: '22:00' }
    });
    assert.equal(dl, '2020-06-01T22:00');
  });
});
