import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { openBlockerOptions } from './taskBlockers';

const task = (id: string, title: string, progressStatus: string) => ({ id, title, progressStatus }) as Task;

describe('openBlockerOptions', () => {
  it('lists open tasks sorted by title, without the task itself', () => {
    const tasks = [task('b', 'Beta', 'ON_TRACK'), task('a', 'Alpha', 'NOT_STARTED'), task('c', 'Gamma', 'COMPLETED'), task('d', 'Delta', 'BEHIND')];
    expect(openBlockerOptions(tasks, 'd').map((o) => o.id)).toEqual(['a', 'b']);
  });
});
