import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { migrateAndNormalizeState } from '../src/js/kanban/migrate-state.js';

describe('migrate-state', () => {
  it('adds defaults for appSettings and archive', () => {
    const s = { columns: [{ id: '1', title: 'X', tasks: [], completed: [] }] };
    migrateAndNormalizeState(s);
    assert.ok(Array.isArray(s.archive));
    assert.equal(s.appSettings.closeToTray, true);
    assert.ok(Array.isArray(s.pomodoroQueue));
  });

  it('normalizes template snapshot field', () => {
    const s = {
      columns: [],
      taskTemplates: [{ id: 't1', name: 'Tpl', snapshot: { title: 'Hi' } }]
    };
    migrateAndNormalizeState(s);
    assert.equal(s.taskTemplates[0].task.title, 'Hi');
    assert.equal(s.taskTemplates[0].snapshot, undefined);
  });
});
