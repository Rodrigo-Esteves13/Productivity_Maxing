import { describe, expect, it } from 'vitest';
import { buildDeadlineGaps, gapTone } from './testGaps';
import type { Task } from '../types/models';

const exam = (id: string, day: string, overrides: Partial<Task> = {}): Task =>
  ({
    id,
    title: id,
    date: `${day}T00:00:00.000Z`,
    dateCertainty: 'EXACT',
    academicType: 'TEST',
    academicTypeIsEvent: true,
    progressStatus: 'ON_TRACK',
    ...overrides,
  }) as unknown as Task;

const work = (id: string, day: string, overrides: Partial<Task> = {}): Task =>
  exam(id, day, { academicType: 'PRACTICAL_ASSIGNMENT', academicTypeIsEvent: false, ...overrides } as Partial<Task>);

const TODAY = '2026-10-30';

describe('buildDeadlineGaps', () => {
  it('conta a folga de cada teste desde o anterior e desde hoje', () => {
    const result = buildDeadlineGaps(
      [exam('c', '2026-11-30'), exam('a', '2026-11-04'), exam('b', '2026-11-17')],
      TODAY,
      'tests',
    );
    expect(result.stops.map((s) => [s.task.id, s.gap, s.fromToday])).toEqual([
      ['a', 5, 5],
      ['b', 13, 18],
      ['c', 13, 31],
    ]);
    expect(result.averageGap).toBe(13);
    expect(result.tightest?.task.id).toBe('b');
  });

  it('ignora datas por marcar, concluidos, passados e revisoes', () => {
    const result = buildDeadlineGaps(
      [
        exam('tbd', '2026-11-05', { dateCertainty: 'UNKNOWN' }),
        exam('done', '2026-11-06', { progressStatus: 'COMPLETED' }),
        exam('past', '2026-10-01'),
        work('review', '2026-11-06', { spacedReviewOfTaskId: 'x' }),
        work('personal', '2026-11-06', { academicType: null }),
        exam('ok', '2026-11-07'),
      ],
      TODAY,
    );
    expect(result.stops.map((s) => s.task.id)).toEqual(['ok']);
    expect(result.tightest).toBeNull();
    expect(result.averageGap).toBeNull();
  });

  it('separa testes de trabalhos e junta-os na vista hibrida', () => {
    const tasks = [exam('t', '2026-11-04'), work('w', '2026-11-06')];
    expect(buildDeadlineGaps(tasks, TODAY, 'tests').stops.map((s) => s.kind)).toEqual(['test']);
    expect(buildDeadlineGaps(tasks, TODAY, 'work').stops.map((s) => s.kind)).toEqual(['due']);
    const all = buildDeadlineGaps(tasks, TODAY, 'all');
    expect(all.stops.map((s) => [s.kind, s.gap])).toEqual([
      ['test', 5],
      ['due', 2],
    ]);
    expect(all.tightest?.task.id).toBe('w');
  });

  it('um trabalho em duas fases da a entrega e a apresentacao, sem contar como aperto', () => {
    const result = buildDeadlineGaps(
      [work('p', '2026-11-10', { submissionDate: '2026-11-08T00:00:00.000Z' }), exam('t', '2026-11-20')],
      TODAY,
    );
    expect(result.stops.map((s) => [s.kind, s.gap, s.followsOwnHandIn])).toEqual([
      ['handIn', 9, false],
      ['presentation', 2, true],
      ['test', 10, false],
    ]);
    // A apresentacao a 2 dias da propria entrega nao e o aperto da fila.
    expect(result.tightest?.kind).toBe('test');
    expect(result.averageGap).toBe(10);
  });

  it('tons: ate 2 dias apertado, ate 5 curto', () => {
    expect([0, 2, 3, 5, 6].map(gapTone)).toEqual(['tight', 'tight', 'short', 'short', 'roomy']);
  });
});
