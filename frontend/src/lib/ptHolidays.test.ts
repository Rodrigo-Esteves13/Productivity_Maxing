import { describe, expect, it } from 'vitest';
import { ptHolidayKeysBetween, ptHolidayOn, ptHolidaysOfYear } from './ptHolidays';

// Mesmos casos do teste do backend (common/pt-holidays.util.spec.ts).
describe('ptHolidays', () => {
  it('tem os 13 feriados nacionais', () => {
    expect(ptHolidaysOfYear(2026)).toHaveLength(13);
  });

  it('calcula os feriados moveis a partir da Pascoa', () => {
    expect(ptHolidayOn('2026-04-03')?.key).toBe('goodFriday');
    expect(ptHolidayOn('2026-06-04')?.key).toBe('corpusChristi');
    expect(ptHolidayOn('2027-03-28')?.key).toBe('easter');
    expect(ptHolidayOn('2026-06-05')).toBeUndefined();
  });

  it('filtra por intervalo, mesmo a passar de ano', () => {
    expect([...ptHolidayKeysBetween('2026-12-20', '2027-01-05')]).toEqual(['2026-12-25', '2027-01-01']);
  });
});
