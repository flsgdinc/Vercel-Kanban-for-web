import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareTasks, sortTaskList, sortAllColumns } from '../src/js/kanban/task-sort.js';

describe('task-sort', () => {
  it('sorts by priority', () => {
    const tasks = [
      { title: 'a', priority: 'low' },
      { title: 'b', priority: 'high' },
      { title: 'c', priority: 'medium' }
    ];
    sortTaskList(tasks, 'priority');
    assert.deepEqual(tasks.map((t) => t.priority), ['high', 'medium', 'low']);
  });

  it('sorts by volume S..XXL', () => {
    const tasks = [
      { title: 'a', volume: 'XL' },
      { title: 'b', volume: 'S' },
      { title: 'c', volume: '' }
    ];
    sortTaskList(tasks, 'volume');
    assert.deepEqual(tasks.map((t) => t.volume), ['S', 'XL', '']);
  });

  it('sorts by name locale', () => {
    const tasks = [{ title: 'Яблоко' }, { title: 'Арбуз' }, { title: 'Банан' }];
    sortTaskList(tasks, 'name');
    assert.deepEqual(tasks.map((t) => t.title), ['Арбуз', 'Банан', 'Яблоко']);
  });

  it('sortAllColumns sorts every column', () => {
    const columns = [
      { tasks: [{ title: 'z' }, { title: 'a' }], completed: [] },
      { tasks: [{ title: 'm' }, { title: 'b' }], completed: [] }
    ];
    sortAllColumns(columns, 'name');
    assert.equal(columns[0].tasks[0].title, 'a');
    assert.equal(columns[1].tasks[0].title, 'b');
    assert.equal(columns[0].sortBy, 'name');
  });
});
