import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { insertIndexAfterRemoval } from '../src/js/kanban/drop-position.js';

function moved(allIds, draggedId, beforeId) {
  const ids = [...allIds];
  const fromIndex = ids.indexOf(draggedId);
  if (fromIndex !== -1) ids.splice(fromIndex, 1);
  ids.splice(insertIndexAfterRemoval(allIds, draggedId, beforeId), 0, draggedId);
  return ids;
}

describe('insertIndexAfterRemoval', () => {
  it('moves a card to the end', () => {
    assert.deepEqual(moved(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'B', null), ['A', 'C', 'D', 'E', 'F', 'G', 'B']);
  });

  it('moves a card before the target ID', () => {
    assert.deepEqual(moved(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'B', 'F'), ['A', 'C', 'D', 'E', 'B', 'F', 'G']);
  });

  it('moves a card upwards', () => {
    assert.deepEqual(moved(['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'E', 'B'), ['A', 'E', 'B', 'C', 'D', 'F', 'G']);
  });

  it('places a cross-column card after hidden cards and before the visible target', () => {
    const destination = ['A', 'H1', 'H2', 'B', 'C', 'D', 'E', 'F'];
    const index = insertIndexAfterRemoval(destination, 'X', 'E');
    destination.splice(index, 0, 'X');
    assert.deepEqual(destination, ['A', 'H1', 'H2', 'B', 'C', 'D', 'X', 'E', 'F']);
  });

  it('moves to the end when the target ID is not found', () => {
    assert.deepEqual(moved(['A', 'B', 'C'], 'B', 'missing'), ['A', 'C', 'B']);
  });

  it('does not change the order when the card is already before the target', () => {
    assert.deepEqual(moved(['A', 'B', 'C'], 'B', 'C'), ['A', 'B', 'C']);
  });
});