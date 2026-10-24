import { describe, expect, it } from 'vitest';
import { absenceRisk, absenceShare, clampAbsenceLimit } from './attendanceLimit';

const row = (attended: number, missed: number, unmarked = 0) => ({ subject: 'Math', attended, missed, unmarked });

describe('attendanceLimit', () => {
  it('counts unmarked classes as held, not missed', () => {
    expect(absenceShare(row(6, 2, 2))).toBe(20);
    expect(absenceShare(row(0, 0))).toBeNull();
  });

  it('flags near and over the limit', () => {
    expect(absenceRisk(row(9, 1), 25)).toBe('none');
    expect(absenceRisk(row(4, 1), 25)).toBe('near');
    expect(absenceRisk(row(3, 1), 25)).toBe('over');
  });

  it('never flags a subject with no absences', () => {
    expect(absenceRisk(row(0, 0, 3), 1)).toBe('none');
  });

  it('clamps the limit to 1-100', () => {
    expect(clampAbsenceLimit(0)).toBe(1);
    expect(clampAbsenceLimit(140)).toBe(100);
    expect(clampAbsenceLimit(Number.NaN)).toBe(25);
  });
});
