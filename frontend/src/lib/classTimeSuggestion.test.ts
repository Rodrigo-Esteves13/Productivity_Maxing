import { describe, expect, it } from 'vitest';
import { classTimeSuggestion } from './classTimeSuggestion';
import { isCalendarTimeFieldVisible } from './calendarTimeField';
import type { ClassOccurrence } from '../types/models';

function occ(over: Partial<ClassOccurrence> = {}): ClassOccurrence {
  return {
    id: 'c1',
    userId: 'u1',
    date: '2026-11-10T00:00:00.000Z',
    startMinutes: 9 * 60 + 30,
    endMinutes: 11 * 60,
    subject: 'Redes III',
    location: null,
    professor: null,
    externalUid: 'x',
    ...over,
  };
}

const base = {
  isEventType: true,
  date: '2026-11-10',
  calendarTime: '',
  timeFieldVisible: true,
  areaName: 'Redes III',
  classes: [occ()],
};

describe('classTimeSuggestion field visibility', () => {
  it('returns null when the time fields are hidden', () => {
    expect(classTimeSuggestion({ ...base, timeFieldVisible: false })).toBeNull();
  });

  it('suggests when the time fields are visible', () => {
    expect(classTimeSuggestion({ ...base, timeFieldVisible: true })?.time).toBe('09:30');
  });
});

describe('isCalendarTimeFieldVisible', () => {
  it('needs calendar connected and sync checked', () => {
    expect(isCalendarTimeFieldVisible(true, true)).toBe(true);
    expect(isCalendarTimeFieldVisible(true, false)).toBe(false);
    expect(isCalendarTimeFieldVisible(false, true)).toBe(false);
    expect(isCalendarTimeFieldVisible(false, false)).toBe(false);
  });
});

describe('classTimeSuggestion', () => {
  it('suggests start and length of the class', () => {
    expect(classTimeSuggestion(base)).toEqual({
      occurrenceId: 'c1',
      time: '09:30',
      durationMinutes: 90,
      rangeLabel: '09:30-11:00',
    });
  });

  it('returns null with no class that day', () => {
    expect(
      classTimeSuggestion({
        ...base,
        classes: [occ({ date: '2026-11-11T00:00:00.000Z' })],
      }),
    ).toBeNull();
    expect(classTimeSuggestion({ ...base, classes: [] })).toBeNull();
  });

  it('returns null for a class of another area', () => {
    expect(classTimeSuggestion({ ...base, classes: [occ({ subject: 'Calculo' })] })).toBeNull();
  });

  it('picks the earliest of several classes', () => {
    const late = occ({
      id: 'late',
      startMinutes: 14 * 60,
      endMinutes: 16 * 60,
    });
    const early = occ({
      id: 'early',
      startMinutes: 8 * 60,
      endMinutes: 9 * 60,
    });
    expect(classTimeSuggestion({ ...base, classes: [late, early] })?.occurrenceId).toBe('early');
  });

  it('ignores cancelled classes', () => {
    expect(classTimeSuggestion({ ...base, classes: [occ({ cancelled: true })] })).toBeNull();
  });

  it('returns null when a time was already set by hand', () => {
    expect(classTimeSuggestion({ ...base, calendarTime: '10:00' })).toBeNull();
  });

  it('returns null for a non-event type', () => {
    expect(classTimeSuggestion({ ...base, isEventType: false })).toBeNull();
  });

  it('returns null without an area or with an invalid date', () => {
    expect(classTimeSuggestion({ ...base, areaName: undefined })).toBeNull();
    expect(classTimeSuggestion({ ...base, date: '' })).toBeNull();
  });

  it('matches the day by the ISO date part, not the local timezone', () => {
    // Meia-noite UTC: em fusos a oeste seria o dia anterior se fosse convertida.
    const result = classTimeSuggestion({
      ...base,
      date: '2026-11-10',
      classes: [
        occ({
          date: '2026-11-10T00:00:00.000Z',
          startMinutes: 0,
          endMinutes: 60,
        }),
      ],
    });
    expect(result?.time).toBe('00:00');
    expect(result?.rangeLabel).toBe('00:00-01:00');
  });

  it('ignores zero or negative length classes', () => {
    expect(
      classTimeSuggestion({
        ...base,
        classes: [occ({ startMinutes: 600, endMinutes: 600 })],
      }),
    ).toBeNull();
  });
});

describe('classTimeSuggestion subject matching', () => {
  const redesI = occ({
    id: 'i',
    subject: 'Comunicacao de Dados e Redes I',
    startMinutes: 600,
    endMinutes: 660,
  });
  const redesIII = occ({
    id: 'iii',
    subject: 'Comunicacao de Dados e Redes III',
    startMinutes: 480,
    endMinutes: 540,
  });

  it('prefers the exact name (I vs III)', () => {
    const r = classTimeSuggestion({
      ...base,
      areaName: 'Comunicacao de Dados e Redes I',
      classes: [redesIII, redesI],
    });
    expect(r?.occurrenceId).toBe('i');
  });

  it('returns none when partial matches are ambiguous', () => {
    const other = occ({ id: 'o', subject: 'Redes III - PL' });
    const r = classTimeSuggestion({ ...base, areaName: 'Redes', classes: [redesIII, other] });
    expect(r).toBeNull();
  });

  it('ignores accents, case and whitespace for the exact match', () => {
    const r = classTimeSuggestion({
      ...base,
      areaName: '  COMUNICAÇÃO de   dados e REDES i ',
      classes: [redesIII, redesI],
    });
    expect(r?.occurrenceId).toBe('i');
  });

  it('falls back to a single partial match without exact match', () => {
    const tp = occ({ id: 'tp', subject: 'Redes III - TP' });
    expect(classTimeSuggestion({ ...base, areaName: 'Redes III', classes: [tp] })?.occurrenceId).toBe('tp');
  });

  it('never matches Redes I to the only class of the day being Redes III', () => {
    expect(
      classTimeSuggestion({ ...base, areaName: 'Comunicacao de Dados e Redes I', classes: [redesIII] }),
    ).toBeNull();
    const tp = occ({ id: 'tp', subject: 'Redes III - TP' });
    expect(classTimeSuggestion({ ...base, areaName: 'Redes I', classes: [tp] })).toBeNull();
  });

  it('still matches a short area name contained word by word in the class name', () => {
    expect(classTimeSuggestion({ ...base, areaName: 'Redes I', classes: [redesI] })?.occurrenceId).toBe('i');
  });
});
