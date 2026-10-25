import { computeWeightedAverage } from './grade-average.util';

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
