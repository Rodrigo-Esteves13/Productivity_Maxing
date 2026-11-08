import {
  computeWeightedAverage,
  roundInterimGrade,
  withInterimRounding,
} from './grade-average.util';

describe('computeWeightedAverage: recurring series (B-06)', () => {
  it('counts a recurring series once, with the mean of its grades', () => {
    const quizzes = Array.from({ length: 10 }, () => ({
      realGrade: 20,
      weightPercentage: 10,
      title: 'Weekly quiz',
      recurrenceFrequency: 'WEEKLY',
      areaId: 'a1',
      periodId: 'p1',
    }));
    const exam = {
      realGrade: 10,
      weightPercentage: 90,
      title: 'Exam',
      recurrenceFrequency: null,
      areaId: 'a1',
      periodId: 'p1',
    };
    const result = computeWeightedAverage([...quizzes, exam]);
    // 20 * 10 + 10 * 90 = 1100 / 100 = 11 (not (200*10 + 900) / 190).
    expect(result.average).toBe(11);
    expect(result.totalWeight).toBe(100);
    expect(result.gradedTaskCount).toBe(11);
  });

  it('keeps non-recurring items as they were', () => {
    const result = computeWeightedAverage([
      { realGrade: 12, weightPercentage: 50 },
      { realGrade: 16, weightPercentage: 50 },
    ]);
    expect(result.average).toBe(14);
  });
});

describe('withInterimRounding', () => {
  const items = [
    { realGrade: 15.5, weightPercentage: 50 },
    { realGrade: null, weightPercentage: 50 },
  ];

  it('rounds each interim grade to the nearest whole number when on', () => {
    expect(withInterimRounding(items, true)[0].realGrade).toBe(16);
    expect(withInterimRounding(items, true)[1].realGrade).toBeNull();
  });

  it('leaves grades untouched when off', () => {
    expect(withInterimRounding(items, false)).toBe(items);
  });
});

describe('roundInterimGrade', () => {
  it('rounds a single grade when on and keeps null', () => {
    expect(roundInterimGrade(15.5, true)).toBe(16);
    expect(roundInterimGrade(null, true)).toBeNull();
  });

  it('leaves the grade untouched when off', () => {
    expect(roundInterimGrade(15.5, false)).toBe(15.5);
  });
});
