import { describe, expect, it } from 'vitest';
import {
  STRONG_WORDING_MIN_N,
  cardInsightKey,
  correlationMetaKey,
  correlationSentenceKey,
  correlationStrength,
  formatPercent,
  quadrantTotal,
  ratedCourseCount,
  readCorrelation,
  strongestCorrelation,
} from './ratings';
import type { RatingCorrelation, RatingCourseRow } from '../types/models';

const corr = (r: number | null, n = 8, enough = true): RatingCorrelation => ({ r, n, enough });
const none = corr(null, 2, false);

describe('correlationStrength', () => {
  it('maps |r| to buckets', () => {
    expect(correlationStrength(0.1)).toBe('none');
    expect(correlationStrength(-0.3)).toBe('weak');
    expect(correlationStrength(0.5)).toBe('moderate');
    expect(correlationStrength(-0.8)).toBe('strong');
  });
});

describe('readCorrelation', () => {
  it('is insufficient without enough data', () => {
    expect(readCorrelation(corr(0.9, 3, false))).toEqual({ kind: 'insufficient', n: 3 });
    expect(readCorrelation(corr(null, 3, false)).kind).toBe('insufficient');
  });
  it('flags no variation', () => {
    expect(readCorrelation(corr(null, 9, true)).kind).toBe('noVariation');
    expect(readCorrelation({ r: null, n: 9, enough: true, reason: 'no_variation' }).kind).toBe('noVariation');
  });
  it('marks small samples and drops the strength word', () => {
    const small = readCorrelation(corr(0.97, STRONG_WORDING_MIN_N - 1));
    expect(small).toMatchObject({ kind: 'ready', small: true, direction: 'positive' });
    if (small.kind === 'ready') expect(correlationMetaKey(small)).toBe('ratings.corr.meta.small');
    const big = readCorrelation(corr(0.97, STRONG_WORDING_MIN_N));
    if (big.kind === 'ready') expect(correlationMetaKey(big)).toBe('ratings.corr.meta.strong');
    const noLink = readCorrelation(corr(0.05, 5));
    if (noLink.kind === 'ready') expect(correlationMetaKey(noLink)).toBe('ratings.corr.meta.none');
  });
  it('gives direction', () => {
    expect(readCorrelation(corr(0.7))).toMatchObject({ direction: 'positive', strength: 'strong' });
    expect(readCorrelation(corr(-0.45))).toMatchObject({ direction: 'negative', strength: 'moderate' });
    expect(readCorrelation(corr(0.05))).toMatchObject({ direction: 'none', strength: 'none' });
  });
});

describe('strongestCorrelation', () => {
  it('picks highest |r| among ready ones', () => {
    const best = strongestCorrelation({
      teacherVsGrade: corr(0.3),
      courseVsGrade: corr(-0.7),
      focusVsGrade: corr(0.9, 2, false),
      courseVsFocus: none,
    });
    expect(best?.id).toBe('courseVsGrade');
  });
  it('is null when nothing is clear', () => {
    expect(
      strongestCorrelation({ teacherVsGrade: corr(0.1), courseVsGrade: none, focusVsGrade: none, courseVsFocus: none }),
    ).toBeNull();
  });
});

describe('helpers', () => {
  it('builds sentence keys', () => {
    expect(correlationSentenceKey('focusVsGrade', 'positive')).toBe('ratings.corr.focusVsGrade.positive');
  });
  it('sums quadrants', () => {
    expect(quadrantTotal({ likedGradeHigh: 1, likedGradeLow: 2, notLikedGradeHigh: 3, notLikedGradeLow: 4 })).toBe(10);
  });
  it('counts rated courses', () => {
    const row = (t: number | null, c: number | null) => ({ teacherRating: t, courseLiking: c }) as RatingCourseRow;
    expect(ratedCourseCount([row(null, null), row(3, null), row(null, 5)])).toBe(2);
  });
  it('formats percent with locale', () => {
    expect(formatPercent(0.5, 'en')).toBe('50%');
  });
});

describe('cardInsightKey', () => {
  it('uses early wording for small samples and strongest otherwise', () => {
    expect(cardInsightKey('teacherVsGrade', 'positive', STRONG_WORDING_MIN_N - 1)).toBe(
      'ratings.card.early.teacherVsGrade.positive',
    );
    expect(cardInsightKey('focusVsGrade', 'negative', STRONG_WORDING_MIN_N)).toBe(
      'ratings.card.strongest.focusVsGrade.negative',
    );
  });
});
