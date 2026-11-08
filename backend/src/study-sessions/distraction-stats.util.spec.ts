import {
  aggregateDistractionStats,
  DISTRACTION_STATS_MIN_SESSIONS,
  type DistractionSessionInput,
} from './distraction-stats.util';

const MIN = 60_000;
const AREA_A = { id: 'a', name: 'Maths', colorHex: '#123456' };
const AREA_B = { id: 'b', name: 'Physics', colorHex: null };

function session(
  startIso: string,
  minutes: number,
  distractionCount: number,
  extra: Partial<DistractionSessionInput> = {},
): DistractionSessionInput {
  const startedAt = new Date(startIso);
  return {
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * MIN),
    distractionCount,
    area: null,
    task: null,
    ...extra,
  };
}

describe('aggregateDistractionStats', () => {
  it('returns empty buckets and zero totals for no sessions', () => {
    const stats = aggregateDistractionStats([]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.byHour).toEqual([]);
    expect(stats.byArea).toEqual([]);
    expect(stats.byEffort).toEqual([]);
    expect(stats.minSessions).toBe(DISTRACTION_STATS_MIN_SESSIONS);
  });

  it('buckets by Lisbon hour of the start (summer, UTC+1)', () => {
    // 19:30 UTC in July = 20:30 Lisbon.
    const stats = aggregateDistractionStats([
      session('2026-07-04T19:30:00.000Z', 60, 2),
    ]);
    expect(stats.byHour).toHaveLength(1);
    expect(stats.byHour[0].hour).toBe(20);
  });

  it('buckets by Lisbon hour in winter (UTC+0)', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T19:30:00.000Z', 60, 2),
    ]);
    expect(stats.byHour[0].hour).toBe(19);
  });

  it('computes distractions per hour from raw minutes with explicit focusHours', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T10:00:00.000Z', 30, 1),
      session('2026-01-11T10:00:00.000Z', 90, 5),
    ]);
    const bucket = stats.byHour[0];
    expect(bucket.sessions).toBe(2);
    expect(bucket.totalMinutes).toBe(120);
    expect(bucket.distractions).toBe(6);
    expect(bucket.focusHours).toBe(2);
    expect(bucket.distractionsPerHour).toBe(3);
  });

  it('flags lowSample below the minimum and clears it at the minimum', () => {
    const base = '2026-01-10T10:00:00.000Z';
    const two = aggregateDistractionStats([
      session(base, 30, 1),
      session(base, 30, 1),
    ]);
    expect(two.byHour[0].lowSample).toBe(true);

    const three = aggregateDistractionStats([
      session(base, 30, 1),
      session(base, 30, 1),
      session(base, 30, 1),
    ]);
    expect(three.byHour[0].lowSample).toBe(false);
  });

  it('honours a custom minimum sample', () => {
    const stats = aggregateDistractionStats(
      [session('2026-01-10T10:00:00.000Z', 30, 1)],
      90,
      1,
    );
    expect(stats.byHour[0].lowSample).toBe(false);
    expect(stats.minSessions).toBe(1);
  });

  it('ignores unfinished sessions and zero or negative durations', () => {
    const open = session('2026-01-10T10:00:00.000Z', 30, 4);
    open.endedAt = null;
    const stats = aggregateDistractionStats([
      open,
      session('2026-01-10T10:00:00.000Z', 0, 3),
      session('2026-01-10T10:00:00.000Z', -5, 3),
    ]);
    expect(stats.totalSessions).toBe(0);
    expect(stats.byHour).toEqual([]);
  });

  it('never yields NaN or Infinity', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T10:00:00.000Z', 0.01, 0),
    ]);
    const bucket = stats.byHour[0];
    expect(Number.isFinite(bucket.distractionsPerHour)).toBe(true);
    expect(Number.isFinite(bucket.focusHours)).toBe(true);
  });

  it('clamps negative distraction counts to zero', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T10:00:00.000Z', 60, -3),
    ]);
    expect(stats.byHour[0].distractions).toBe(0);
  });

  it('groups by area, sorted by minutes, with a null-area bucket', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T10:00:00.000Z', 30, 1, { area: AREA_A }),
      session('2026-01-10T11:00:00.000Z', 120, 2, { area: AREA_B }),
      session('2026-01-10T12:00:00.000Z', 10, 0),
    ]);
    expect(stats.byArea.map((a) => a.areaId)).toEqual(['b', 'a', null]);
    expect(stats.byArea[2].areaName).toBeNull();
    expect(stats.byArea[1].areaColorHex).toBe('#123456');
  });

  it('groups by effort in fixed order, null effort counts as MODERATE, no-task sessions are skipped', () => {
    const stats = aggregateDistractionStats([
      session('2026-01-10T10:00:00.000Z', 30, 1, {
        task: { effort: 'HEAVY' },
      }),
      session('2026-01-10T11:00:00.000Z', 30, 1, {
        task: { effort: null },
      }),
      session('2026-01-10T12:00:00.000Z', 30, 1, {
        task: { effort: 'LIGHT' },
      }),
      session('2026-01-10T13:00:00.000Z', 30, 9),
    ]);
    expect(stats.byEffort.map((e) => e.effort)).toEqual([
      'LIGHT',
      'MODERATE',
      'HEAVY',
    ]);
    expect(stats.totalSessions).toBe(4);
  });

  it('orders hours ascending and echoes the window', () => {
    const stats = aggregateDistractionStats(
      [
        session('2026-01-10T15:00:00.000Z', 30, 1),
        session('2026-01-10T08:00:00.000Z', 30, 1),
      ],
      30,
    );
    expect(stats.byHour.map((h) => h.hour)).toEqual([8, 15]);
    expect(stats.windowDays).toBe(30);
  });
});
