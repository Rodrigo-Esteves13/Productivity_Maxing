import { afterEach, describe, expect, it } from 'vitest';
import { newEntryDateIso, toDateInputValue } from './notebookEntryConfig';

// Silent audit (area c), finding C-05. A new Notebook entry is created with
// `date: new Date().toISOString()` (Notebook.tsx handleNewEntry) and the
// editor reads it back with toDateInputValue(iso) = iso.slice(0, 10), i.e.
// the UTC day. The editor then saves `${dateValue}T12:00:00` local on the
// next autosave, so the wrong day is persisted without any message.

const originalTz = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTz;
});

describe('toDateInputValue keeps the local day (C-05)', () => {
  it('keeps the local day for an entry created at 22:30 in Sao Paulo (UTC-3)', () => {
    process.env.TZ = 'America/Sao_Paulo';
    // What handleNewEntry sends at 22:30 local on 24 Oct 2026.
    const createdIso = new Date('2026-10-24T22:30:00-03:00').toISOString();
    // Fails today: returns '2026-10-25' (the UTC day).
    expect(toDateInputValue(createdIso)).toBe('2026-10-24');
  });

  it('keeps the local day for an entry created at 08:00 in Tokyo (UTC+9)', () => {
    process.env.TZ = 'Asia/Tokyo';
    const createdIso = new Date('2026-10-24T08:00:00+09:00').toISOString();
    // Fails today: returns '2026-10-23'.
    expect(toDateInputValue(createdIso)).toBe('2026-10-24');
  });

  it('a new entry created in UTC+13 keeps its local day after a save round trip', () => {
    process.env.TZ = 'Pacific/Auckland';
    // 09:00 on 24 Jan 2027 in Auckland (NZDT, UTC+13).
    const created = newEntryDateIso(new Date('2027-01-24T09:00:00+13:00'));
    const day = toDateInputValue(created);
    expect(day).toBe('2027-01-24');
    // The editor saves `${day}T12:00:00` local; reading it back gives the same day.
    expect(toDateInputValue(new Date(`${day}T12:00:00`).toISOString())).toBe('2027-01-24');
  });
});
