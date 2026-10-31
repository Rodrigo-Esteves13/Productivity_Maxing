import {
  absenceRisk,
  absenceShare,
  MIN_HELD_CLASSES,
} from './absence-limit.util';

const row = (attended: number, missed: number, unmarked = 0) => ({
  subject: 'Math',
  attended,
  missed,
  unmarked,
});

describe('absence-limit util', () => {
  it('computes share over held classes including unmarked', () => {
    expect(absenceShare(row(6, 2, 2))).toBe(20);
    expect(absenceShare(row(0, 0, 0))).toBeNull();
  });

  it('ignores courses below the minimum sample', () => {
    expect(MIN_HELD_CLASSES).toBe(4);
    expect(absenceRisk(row(0, 1))).toBe('none'); // 100% de 1 aula
    expect(absenceRisk(row(1, 2))).toBe('none'); // 66% de 3 aulas
  });

  it('flags near/over once the minimum sample is reached', () => {
    expect(absenceRisk(row(3, 1))).toBe('over'); // 25% de 4
    expect(absenceRisk(row(4, 1))).toBe('near'); // 20% de 5
    expect(absenceRisk(row(9, 1))).toBe('none'); // 10%
  });

  it('never flags without absences', () => {
    expect(absenceRisk(row(0, 0, 10))).toBe('none');
  });
});
