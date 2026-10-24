import { buildStudyVsClass } from './study-vs-class.util';

const at = (iso: string) => new Date(iso);

describe('buildStudyVsClass', () => {
  const areas = [
    { id: 'a', name: 'Algebra', colorHex: '#111111' },
    { id: 'b', name: 'Biology', colorHex: '#222222' },
    { id: 'c', name: 'Chemistry', colorHex: '#333333' },
  ];
  const links = new Map([
    ['ALG', 'a'],
    ['BIO', 'b'],
  ]);

  it('sums class time per linked course and study time per area', () => {
    const result = buildStudyVsClass(
      [
        { subject: 'ALG', startMinutes: 540, endMinutes: 660 },
        { subject: 'ALG', startMinutes: 540, endMinutes: 600 },
        { subject: 'BIO', startMinutes: 600, endMinutes: 690 },
        { subject: 'PE', startMinutes: 600, endMinutes: 660 },
      ],
      [
        {
          areaId: 'a',
          startedAt: at('2026-10-01T10:00:00Z'),
          endedAt: at('2026-10-01T11:30:00Z'),
        },
        { areaId: 'a', startedAt: at('2026-10-02T10:00:00Z'), endedAt: null },
        {
          areaId: 'c',
          startedAt: at('2026-10-02T10:00:00Z'),
          endedAt: at('2026-10-02T10:30:00Z'),
        },
        {
          areaId: null,
          startedAt: at('2026-10-02T10:00:00Z'),
          endedAt: at('2026-10-02T12:00:00Z'),
        },
      ],
      links,
      areas,
    );
    expect(result.rows).toEqual([
      expect.objectContaining({
        areaId: 'a',
        classMinutes: 180,
        studyMinutes: 90,
        ratio: 0.5,
      }),
      expect.objectContaining({
        areaId: 'b',
        classMinutes: 90,
        studyMinutes: 0,
        ratio: 0,
      }),
      expect.objectContaining({
        areaId: 'c',
        classMinutes: 0,
        studyMinutes: 30,
        ratio: null,
      }),
    ]);
    expect(result.unlinkedSubjects).toEqual(['PE']);
  });
});
