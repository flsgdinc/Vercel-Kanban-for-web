import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  packPersistPayload,
  unpackPersistPayload,
  validateImportPayload,
  PERSIST_VERSION
} from '../src/js/state-envelope.js';

describe('state-envelope', () => {
  it('packs versioned payload', () => {
    const p = packPersistPayload({ columns: [] }, 'dark');
    assert.equal(p.version, PERSIST_VERSION);
    assert.equal(p.theme, 'dark');
    assert.deepEqual(p.state.columns, []);
  });

  it('unpacks legacy columns root', () => {
    const u = unpackPersistPayload({ columns: [{ id: '1', tasks: [], completed: [] }] });
    assert.ok(u?.state.columns);
  });

  it('rejects invalid import', () => {
    const r = validateImportPayload({ foo: 1 });
    assert.equal(r.ok, false);
  });

  it('accepts valid import', () => {
    const r = validateImportPayload({
      version: PERSIST_VERSION,
      state: {
        columns: [{ id: '1', title: 'A', tasks: [], completed: [] }]
      }
    });
    assert.equal(r.ok, true);
    assert.equal(r.state.columns.length, 1);
  });
});
