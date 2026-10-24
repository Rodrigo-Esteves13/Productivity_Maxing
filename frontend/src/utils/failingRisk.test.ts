import { describe, expect, it } from 'vitest';
import { computeFailingRisk, parseScaleBounds, passThreshold } from './failingRisk';
import type { Area, GradeComponent, Task } from '../types/models';

const area = (id: string) => ({ id, name: id.toUpperCase() }) as Area;
const task = (areaId: string, weight: number | null, grade: number | null) =>
  ({ areaId, weightPercentage: weight, realGrade: grade }) as Task;

describe('computeFailingRisk', () => {
  it('uses the backend pass mark (middle of the scale)', () => {
    expect(passThreshold(parseScaleBounds('0-20'))).toBe(10);
    expect(passThreshold(parseScaleBounds('1-5'))).toBe(3);
  });

  it('flags a course that needs a very high grade on what is left', () => {
    // 40% avaliado a 6/20: precisa de (1000 - 240) / 60 = 12.7 -> ainda nao "high"
    // 50% avaliado a 4/20: precisa de (1000 - 200) / 50 = 16 -> high
    const rows = computeFailingRisk(
      [task('a', 40, 6), task('a', 60, null), task('b', 50, 4), task('b', 50, null)],
      [area('a'), area('b')],
      [],
      '0-20',
    );
    expect(rows.map((r) => [r.area.id, r.level, r.neededOnRest])).toEqual([
      ['b', 'high', 16],
      ['a', 'watch', 12.7],
    ]);
  });

  it('says impossible when not even the top grade is enough', () => {
    const [row] = computeFailingRisk([task('a', 80, 5), task('a', 20, null)], [area('a')], [], '0-20');
    expect(row.level).toBe('impossible');
    expect(row.remainingWeightPct).toBe(20);
  });

  it('counts graded components and skips safe courses', () => {
    const components = [{ areaId: 'a', weightPercentage: 30, grade: 16 }] as GradeComponent[];
    expect(computeFailingRisk([task('a', 30, 14)], [area('a')], components, '0-20')).toEqual([]);
  });

  it('ignores courses with too little graded or tasks without weight', () => {
    expect(computeFailingRisk([task('a', 10, 2)], [area('a')], [], '0-20')).toEqual([]);
    expect(computeFailingRisk([task('a', 50, 2), task('a', null, null)], [area('a')], [], '0-20')).toEqual([]);
  });
});
