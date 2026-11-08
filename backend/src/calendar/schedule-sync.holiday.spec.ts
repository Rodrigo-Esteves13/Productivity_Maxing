import {
  buildDesiredEvents,
  diffEvents,
  toGoogleEventBody,
} from './schedule-sync.builder';
import { CALENDAR_TIME_ZONE } from './schedule-sync.constants';
import type { ExistingSyncedEvent } from './schedule-sync.types';

const base = { classes: [], shifts: [], study: [], travel: [] };

describe('buildDesiredEvents holidays', () => {
  it('builds an all-day holiday event with label', () => {
    const events = buildDesiredEvents({
      ...base,
      holidays: [
        { commitmentId: 'c1', date: '2026-12-25', label: 'Christmas' },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      kind: 'holiday',
      sourceKey: 'holiday:c1:2026-12-25',
      date: '2026-12-25',
      startMinutes: 0,
      endMinutes: 1440,
      title: 'No work: Christmas',
    });
  });

  it('uses the generic title and "none" key when label and commitment are null', () => {
    const [e] = buildDesiredEvents({
      ...base,
      holidays: [{ commitmentId: null, date: '2026-01-01', label: null }],
    });
    expect(e.title).toBe('No work (holiday)');
    expect(e.sourceKey).toBe('holiday:none:2026-01-01');
  });

  it('yields no holiday events when holidays is omitted', () => {
    expect(
      buildDesiredEvents(base).filter((e) => e.kind === 'holiday'),
    ).toEqual([]);
  });
});

describe('toGoogleEventBody', () => {
  it('sends a holiday as an all-day event (date only, end exclusive)', () => {
    const [holiday] = buildDesiredEvents({
      ...base,
      holidays: [{ commitmentId: 'c1', date: '2026-12-31', label: null }],
    });
    const body = toGoogleEventBody(holiday);
    expect(body.start).toEqual({ date: '2026-12-31' });
    expect(body.end).toEqual({ date: '2027-01-01' });
    expect(body).toMatchObject({ transparency: 'transparent' });
  });

  it('keeps timed events with dateTime and time zone', () => {
    const [cls] = buildDesiredEvents({
      ...base,
      classes: [
        {
          id: 'k1',
          date: '2026-12-01',
          startMinutes: 540,
          endMinutes: 1440,
          subject: 'Algebra',
          location: null,
          professor: null,
        },
      ],
    });
    const body = toGoogleEventBody(cls);
    expect(body.start).toEqual({
      dateTime: '2026-12-01T09:00:00',
      timeZone: CALENDAR_TIME_ZONE,
    });
    expect(body.end).toEqual({
      dateTime: '2026-12-02T00:00:00',
      timeZone: CALENDAR_TIME_ZONE,
    });
    expect(body).not.toHaveProperty('transparency');
  });
});

describe('diffEvents with holidays', () => {
  it('does not delete a past holiday event that is no longer desired', () => {
    const existing: ExistingSyncedEvent[] = [
      {
        sourceKey: 'holiday:c1:2026-01-01',
        date: '2026-01-01',
        startMinutes: 0,
        endMinutes: 1440,
        contentHash: 'x',
      } as ExistingSyncedEvent,
    ];
    const diff = diffEvents([], existing, {
      todayKey: '2026-06-01',
      nowMinutes: 600,
    });
    expect(diff.toDelete).toEqual([]);
  });

  it('deletes a future holiday event that is no longer desired', () => {
    const existing = [
      {
        sourceKey: 'holiday:c1:2026-12-25',
        date: '2026-12-25',
        startMinutes: 0,
        endMinutes: 1440,
        contentHash: 'x',
      } as ExistingSyncedEvent,
    ];
    const diff = diffEvents([], existing, {
      todayKey: '2026-06-01',
      nowMinutes: 600,
    });
    expect(diff.toDelete).toHaveLength(1);
  });
});
