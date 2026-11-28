import { describe, expect, it } from 'vitest';
import { parseGradeTargets, withGradeTarget } from './gradeTargets';

describe('parseGradeTargets', () => {
  it('returns empty for null, junk and non-objects', () => {
    expect(parseGradeTargets(null)).toEqual({});
    expect(parseGradeTargets('{oops')).toEqual({});
    expect(parseGradeTargets('[1,2]')).toEqual({});
  });
  it('keeps only string values', () => {
    expect(parseGradeTargets('{"a":"15","b":3}')).toEqual({ a: '15' });
  });
});

describe('withGradeTarget', () => {
  it('sets and clears without mutating', () => {
    const base = { a: '10' };
    expect(withGradeTarget(base, 'b', '12')).toEqual({ a: '10', b: '12' });
    expect(withGradeTarget(base, 'a', '')).toEqual({});
    expect(base).toEqual({ a: '10' });
  });
});
