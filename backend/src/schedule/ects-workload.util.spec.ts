import {
  buildEctsWorkload,
  ectsRangeDays,
  ectsStudyWindow,
  isRealDateKey,
  keepFinishedClasses,
} from './ects-workload.util';

const at = (iso: string) => new Date(iso);

const areas = [
  { id: 'a', name: 'Algebra', credits: 6 },
  { id: 'b', name: 'Biology', credits: 3 },
  { id: 'n', name: 'Swimming', credits: null },
  { id: 'z', name: 'Zero', credits: 0 },
];
const links = new Map([
  ['ALG', 'a'],
  ['BIO', 'b'],
  ['SWM', 'n'],
]);
const window = ectsStudyWindow('2026-07-01', '2026-07-31');

const cls = (
  subject: string,
  startMinutes: number,
  endMinutes: number,
  extra: { cancelled?: boolean; attended?: boolean | null } = {},
) => ({
  subject,
  startMinutes,
  endMinutes,
  cancelled: extra.cancelled ?? false,
  attended: extra.attended ?? null,
});

describe('buildEctsWorkload', () => {
  it('sums class and study minutes per credited course', () => {
    const result = buildEctsWorkload(
      [cls('ALG', 540, 660), cls('BIO', 600, 690, { attended: true })],
      [
        {
          areaId: 'a',
          startedAt: at('2026-07-10T10:00:00Z'),
          endedAt: at('2026-07-10T11:30:00Z'),
        },
      ],
      links,
      areas,
      window,
    );
    expect(result.courses).toEqual([
      {
        areaId: 'a',
        name: 'Algebra',
        credits: 6,
        classMinutes: 120,
        studyMinutes: 90,
      },
      {
        areaId: 'b',
        name: 'Biology',
        credits: 3,
        classMinutes: 90,
        studyMinutes: 0,
      },
    ]);
  });

  it('excludes cancelled classes and attended=false, counts attended=null', () => {
    const result = buildEctsWorkload(
      [
        cls('ALG', 0, 60, { cancelled: true }),
        cls('ALG', 0, 60, { attended: false }),
        cls('ALG', 0, 60, { attended: null }),
        cls('ALG', 0, 30, { attended: true }),
      ],
      [],
      links,
      areas,
      window,
    );
    expect(result.courses[0].classMinutes).toBe(90);
  });

  it('lists unlinked subjects distinct and sorted', () => {
    const result = buildEctsWorkload(
      [cls('ZZZ', 0, 60), cls('PE', 0, 60), cls('ZZZ', 60, 120)],
      [],
      links,
      areas,
      window,
    );
    expect(result.unlinkedSubjects).toEqual(['PE', 'ZZZ']);
  });

  it('omits areas without credits or with zero credits', () => {
    const result = buildEctsWorkload(
      [cls('SWM', 0, 60)],
      [],
      links,
      areas,
      window,
    );
    expect(result.courses.map((c) => c.areaId)).toEqual(['a', 'b']);
  });

  it('ignores unfinished sessions and sessions without area', () => {
    const result = buildEctsWorkload(
      [],
      [
        { areaId: 'a', startedAt: at('2026-07-10T10:00:00Z'), endedAt: null },
        {
          areaId: null,
          startedAt: at('2026-07-10T10:00:00Z'),
          endedAt: at('2026-07-10T11:00:00Z'),
        },
      ],
      links,
      areas,
      window,
    );
    expect(result.courses[0].studyMinutes).toBe(0);
  });

  it('uses Lisbon midnight (summer, UTC+1) as window boundary', () => {
    const june30 = at('2026-06-30T23:30:00Z'); // 00:30 Lisbon on Jul 1: inside
    const jun30Before = at('2026-06-30T22:30:00Z'); // 23:30 Lisbon Jun 30: outside
    const aug1Inside = at('2026-07-31T22:30:00Z'); // 23:30 Lisbon Jul 31: inside
    const aug1Out = at('2026-07-31T23:30:00Z'); // 00:30 Lisbon Aug 1: outside
    const hour = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000);
    const result = buildEctsWorkload(
      [],
      [june30, jun30Before, aug1Inside, aug1Out].map((d) => ({
        areaId: 'a',
        startedAt: d,
        endedAt: hour(d),
      })),
      links,
      areas,
      window,
    );
    expect(result.courses[0].studyMinutes).toBe(120);
  });
});

describe('isRealDateKey', () => {
  it('accepts real dates, rejects impossible or malformed ones', () => {
    expect(isRealDateKey('2026-02-28')).toBe(true);
    expect(isRealDateKey('2028-02-29')).toBe(true);
    expect(isRealDateKey('2026-02-29')).toBe(false);
    expect(isRealDateKey('2026-13-01')).toBe(false);
    expect(isRealDateKey('2026-04-31')).toBe(false);
    expect(isRealDateKey('2026-1-01')).toBe(false);
    expect(isRealDateKey(undefined)).toBe(false);
  });
});

describe('ectsRangeDays', () => {
  it('counts both ends inclusive', () => {
    expect(ectsRangeDays('2026-07-01', '2026-07-01')).toBe(1);
    expect(ectsRangeDays('2026-07-01', '2026-07-31')).toBe(31);
  });
});

describe('keepFinishedClasses', () => {
  it('only filters rows of today by end time', () => {
    const rows = [
      { dateKey: '2026-07-14', endMinutes: 1200 },
      { dateKey: '2026-07-15', endMinutes: 600 },
      { dateKey: '2026-07-15', endMinutes: 720 },
      { dateKey: '2026-07-15', endMinutes: 721 },
    ];
    expect(
      keepFinishedClasses(rows, '2026-07-15', 720).map((r) => r.endMinutes),
    ).toEqual([1200, 600, 720]);
  });
});
