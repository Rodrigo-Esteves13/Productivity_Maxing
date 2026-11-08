import { describe, expect, it } from 'vitest';
import { roundInterimGrade } from './interimGrade';

describe('roundInterimGrade', () => {
  it('rounds to the nearest whole number when the program option is on', () => {
    expect(roundInterimGrade(15.5, true)).toBe(16);
    expect(roundInterimGrade(14.4, true)).toBe(14);
  });

  it('keeps the grade as is when the option is off', () => {
    expect(roundInterimGrade(15.5, false)).toBe(15.5);
  });
});
