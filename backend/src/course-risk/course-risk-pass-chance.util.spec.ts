import {
  confidenceFor,
  failChancePct,
  passChancePct,
} from './course-risk-pass-chance.util';
import {
  CONFIDENCE_HIGH_FROM_PCT,
  CONFIDENCE_MEDIUM_FROM_PCT,
} from './course-risk.constants';

const NONE_LEFT = 0;
const SOME_LEFT = 40;

describe('passChancePct', () => {
  it.each([
    [0, 100],
    [100, 0],
    [30, 70],
    [30.4, 70],
    [30.5, 70],
    [30.6, 69],
    [69.6, 30],
    [-10, 100],
    [150, 0],
  ])('score %p with no weight left -> %p', (score, expected) => {
    expect(passChancePct({ score, remainingWeightPct: NONE_LEFT })).toBe(
      expected,
    );
  });

  it.each([
    [0, 99],
    [-10, 99],
    [0.4, 99],
    [1, 99],
    [2, 98],
    [99, 1],
    [98, 2],
    [30, 70],
  ])('score %p with weight left stays in [1, 99] -> %p', (score, expected) => {
    expect(passChancePct({ score, remainingWeightPct: SOME_LEFT })).toBe(
      expected,
    );
  });

  it('score 100 (failure decided) is 0 even with weight left', () => {
    expect(passChancePct({ score: 100, remainingWeightPct: SOME_LEFT })).toBe(
      0,
    );
    expect(passChancePct({ score: 150, remainingWeightPct: SOME_LEFT })).toBe(
      0,
    );
  });

  it('is 100 only when nothing remains to be graded', () => {
    expect(passChancePct({ score: 0, remainingWeightPct: NONE_LEFT })).toBe(
      100,
    );
    expect(passChancePct({ score: 0, remainingWeightPct: SOME_LEFT })).toBe(99);
    expect(
      passChancePct({ score: 0, remainingWeightPct: Number.EPSILON }),
    ).toBe(99);
  });
});

describe('failChancePct', () => {
  it('is the complement of the pass chance', () => {
    expect(failChancePct(70)).toBe(30);
    expect(failChancePct(0)).toBe(100);
    expect(failChancePct(100)).toBe(0);
    expect(failChancePct(99)).toBe(1);
  });
});

describe('confidenceFor', () => {
  it.each([
    [0, 'low'],
    [CONFIDENCE_MEDIUM_FROM_PCT - 1, 'low'],
    [CONFIDENCE_MEDIUM_FROM_PCT, 'medium'],
    [CONFIDENCE_HIGH_FROM_PCT - 1, 'medium'],
    [CONFIDENCE_HIGH_FROM_PCT, 'high'],
    [100, 'high'],
  ])('graded weight %p -> %p', (weight, expected) => {
    expect(confidenceFor(weight)).toBe(expected);
  });
});
