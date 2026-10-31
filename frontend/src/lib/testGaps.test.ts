import { describe, expect, it } from 'vitest';
import { buildTestGaps, gapTone } from './testGaps';
import type { Task } from '../types/models';

const exam = (id: string, day: string, overrides: Partial<Task> = {}): Task =>
  ({
    id,
    title: id,
    date: `${day}T00:00:00.000Z`,
    dateCertainty: 'EXACT',
    academicTypeIsEvent: true,
    progressStatus: 'ON_TRACK',
    ...overrides,
  }) as unknown as Task;

describe('buildTestGaps', () => {
  it('conta a folga de cada teste desde o anterior e desde hoje', () => {
    const result = buildTestGaps(
      [exam('c', '2026-11-30'), exam('a', '2026-11-04'), exam('b', '2026-11-17')],
      '2026-10-30',
    );
    expect(result.stops.map((s) => [s.task.id, s.gap, s.fromToday])).toEqual([
      ['a', 5, 5],
      ['b', 13, 18],
      ['c', 13, 31],
    ]);
    expect(result.averageGap).toBe(13);
    expect(result.tightest?.task.id).toBe('b');
  });

  it('ignora o que nao e teste, datas por marcar, concluidos e passados', () => {
    const result = buildTestGaps(
      [
        exam('assignment', '2026-11-04', { academicTypeIsEvent: false }),
        exam('tbd', '2026-11-05', { dateCertainty: 'UNKNOWN' }),
        exam('done', '2026-11-06', { progressStatus: 'COMPLETED' }),
        exam('past', '2026-10-01'),
        exam('ok', '2026-11-07'),
      ],
      '2026-10-30',
    );
    expect(result.stops.map((s) => s.task.id)).toEqual(['ok']);
    expect(result.tightest).toBeNull();
    expect(result.averageGap).toBeNull();
  });

  it('marca folgas apertadas e esconde o que passa do limite', () => {
    const result = buildTestGaps(
      [exam('a', '2026-11-04'), exam('b', '2026-11-05'), exam('c', '2026-11-20')],
      '2026-10-30',
      2,
    );
    expect(result.stops[1].tone).toBe('tight');
    expect(result.hidden).toBe(1);
  });

  it('tons: ate 2 dias apertado, ate 5 curto', () => {
    expect([0, 2, 3, 5, 6].map(gapTone)).toEqual(['tight', 'tight', 'short', 'short', 'roomy']);
  });
});
