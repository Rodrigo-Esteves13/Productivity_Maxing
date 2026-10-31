import { ptHolidayKeysBetween, ptHolidaysOfYear } from './pt-holidays.util';

describe('ptHolidaysOfYear', () => {
  it('tem os 13 feriados nacionais', () => {
    expect(ptHolidaysOfYear(2026)).toHaveLength(13);
  });

  it('calcula os feriados moveis a partir da Pascoa', () => {
    const byKey = (year: number) =>
      new Map(ptHolidaysOfYear(year).map((h) => [h.key, h.date]));
    // Pascoa 2026: 5 de abril; 2027: 28 de marco.
    expect(byKey(2026).get('goodFriday')).toBe('2026-04-03');
    expect(byKey(2026).get('easter')).toBe('2026-04-05');
    expect(byKey(2026).get('corpusChristi')).toBe('2026-06-04');
    expect(byKey(2027).get('easter')).toBe('2027-03-28');
    expect(byKey(2027).get('corpusChristi')).toBe('2027-05-27');
  });

  it('filtra por intervalo, mesmo a passar de ano', () => {
    expect([...ptHolidayKeysBetween('2026-12-20', '2027-01-05')]).toEqual([
      '2026-12-25',
      '2027-01-01',
    ]);
  });
});
