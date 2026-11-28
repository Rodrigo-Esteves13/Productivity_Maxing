import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import { applyBulkReschedule } from './taskReschedule';

const NEW_DATE = '2026-11-10T00:00:00.000Z';

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    date: '2026-11-01T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    postponedCount: 1,
    dateCertainty: 'EXACT',
    submissionDate: null,
    ...extra,
  } as Task;
}

describe('applyBulkReschedule', () => {
  it('moves only the given open tasks and counts a later date as postponed', () => {
    const tasks = [task('a'), task('b'), task('c', { progressStatus: 'COMPLETED' })];
    const [a, b, c] = applyBulkReschedule(tasks, new Set(['a', 'c']), NEW_DATE);
    expect(a).toMatchObject({ date: NEW_DATE, postponedCount: 2 });
    expect(b).toBe(tasks[1]);
    expect(c).toBe(tasks[2]);
  });

  it('does not count a move to an earlier date or of a guessed date', () => {
    const [earlier, guess] = applyBulkReschedule(
      [task('a', { date: '2026-12-01T00:00:00.000Z' }), task('b', { dateCertainty: 'UNKNOWN' })],
      new Set(['a', 'b']),
      NEW_DATE,
    );
    expect(earlier).toMatchObject({ date: NEW_DATE, postponedCount: 1 });
    expect(guess).toMatchObject({ date: NEW_DATE, postponedCount: 1 });
  });

  it('never leaves the hand-in after the new date', () => {
    const [after, before] = applyBulkReschedule(
      [
        task('a', { submissionDate: '2026-11-20T00:00:00.000Z' }),
        task('b', { submissionDate: '2026-11-05T00:00:00.000Z' }),
      ],
      new Set(['a', 'b']),
      NEW_DATE,
    );
    expect(after.submissionDate).toBe(NEW_DATE);
    expect(before.submissionDate).toBe('2026-11-05T00:00:00.000Z');
  });
});
