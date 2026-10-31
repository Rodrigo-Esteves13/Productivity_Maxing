import {
  areaAbsenceShare,
  buildRiskComponents,
  sumStudyVsEstimate,
  type RiskTaskRow,
} from './course-risk-input.util';

const NOW = new Date('2026-10-15T12:00:00.000Z');
const PAST = new Date('2026-10-01T00:00:00.000Z');
const FUTURE = new Date('2026-11-20T00:00:00.000Z');

const row = (over: Partial<RiskTaskRow>): RiskTaskRow => ({
  title: 'T',
  date: PAST,
  completedAt: null,
  weightPercentage: null,
  realGrade: null,
  recurrenceFrequency: null,
  estimatedMinutes: null,
  recalledStudyMinutes: null,
  postponedCount: 0,
  studySessions: [],
  ...over,
});

describe('buildRiskComponents', () => {
  it('collapses a recurring series into one component', () => {
    const result = buildRiskComponents(
      [
        row({
          title: 'Quiz',
          weightPercentage: 10,
          realGrade: 10,
          recurrenceFrequency: 'WEEKLY',
        }),
        row({
          title: 'Quiz',
          weightPercentage: 10,
          realGrade: 14,
          recurrenceFrequency: 'WEEKLY',
        }),
        row({
          title: 'Quiz',
          weightPercentage: 10,
          recurrenceFrequency: 'WEEKLY',
        }),
      ],
      [],
    );
    expect(result).toEqual([{ label: 'Quiz', weightPct: 10, grade: 12 }]);
  });

  it('keeps ungraded weighted tasks as pending and skips every unweighted task', () => {
    const result = buildRiskComponents(
      [
        row({ title: 'Exam', weightPercentage: 60 }),
        row({ title: 'Note only' }),
        row({ title: 'Lab', realGrade: 15 }),
      ],
      [],
    );
    expect(result).toEqual([{ label: 'Exam', weightPct: 60, grade: null }]);
  });

  it('never turns graded tasks without weight into components (no 1% hard-rule trap)', () => {
    const result = buildRiskComponents(
      [
        row({ title: 'Homework', realGrade: 5 }),
        row({
          title: 'Quiz',
          realGrade: 4,
          recurrenceFrequency: 'WEEKLY',
        }),
        row({ title: 'Test', weightPercentage: 50, realGrade: 16 }),
      ],
      [],
    );
    expect(result).toEqual([{ label: 'Test', weightPct: 50, grade: 16 }]);
  });

  it('takes the series weight from any weighted occurrence', () => {
    const result = buildRiskComponents(
      [
        row({ title: 'Quiz', realGrade: 10, recurrenceFrequency: 'WEEKLY' }),
        row({
          title: 'Quiz',
          weightPercentage: 10,
          realGrade: 14,
          recurrenceFrequency: 'WEEKLY',
        }),
      ],
      [],
    );
    expect(result).toEqual([{ label: 'Quiz', weightPct: 10, grade: 14 }]);
  });

  it('aggregates grade components with their rule and keeps empty ones pending', () => {
    const result = buildRiskComponents(
      [],
      [
        {
          name: 'Best two',
          weightPercentage: 20,
          aggregation: 'BEST_OF',
          bestOfCount: 2,
          entries: [{ grade: 8 }, { grade: 12 }, { grade: 16 }],
        },
        {
          name: 'Empty',
          weightPercentage: 10,
          aggregation: 'AVERAGE',
          bestOfCount: null,
          entries: [],
        },
      ],
    );
    expect(result).toEqual([
      { label: 'Best two', weightPct: 20, grade: 14 },
      { label: 'Empty', weightPct: 10, grade: null },
    ]);
  });
});

describe('sumStudyVsEstimate', () => {
  it('returns nulls without any estimate', () => {
    expect(sumStudyVsEstimate([row({})], NOW)).toEqual({
      studiedMinutes: null,
      estimatedMinutes: null,
    });
  });

  it('uses logged sessions before recalled minutes', () => {
    const start = new Date('2026-10-01T10:00:00.000Z');
    const end = new Date('2026-10-01T11:00:00.000Z');
    expect(
      sumStudyVsEstimate(
        [
          row({
            estimatedMinutes: 180,
            recalledStudyMinutes: 10,
            studySessions: [{ startedAt: start, endedAt: end }],
          }),
        ],
        NOW,
      ),
    ).toEqual({ studiedMinutes: 60, estimatedMinutes: 180 });
  });

  it('ignores future tasks that are not completed or graded', () => {
    const result = sumStudyVsEstimate(
      [
        row({ estimatedMinutes: 100, recalledStudyMinutes: 40 }),
        row({ date: FUTURE, estimatedMinutes: 500 }),
      ],
      NOW,
    );
    expect(result).toEqual({ studiedMinutes: 40, estimatedMinutes: 100 });
  });

  it('counts future-dated tasks that are already completed or graded', () => {
    const result = sumStudyVsEstimate(
      [
        row({
          date: FUTURE,
          completedAt: PAST,
          estimatedMinutes: 60,
          recalledStudyMinutes: 60,
        }),
        row({
          date: FUTURE,
          realGrade: 14,
          estimatedMinutes: 90,
          recalledStudyMinutes: 30,
        }),
      ],
      NOW,
    );
    expect(result).toEqual({ studiedMinutes: 90, estimatedMinutes: 150 });
  });

  it('returns nulls when only future tasks have estimates', () => {
    expect(
      sumStudyVsEstimate([row({ date: FUTURE, estimatedMinutes: 120 })], NOW),
    ).toEqual({ studiedMinutes: null, estimatedMinutes: null });
  });
});

describe('areaAbsenceShare', () => {
  it('is null without linked classes or with too few classes held', () => {
    expect(areaAbsenceShare([])).toBeNull();
    expect(
      areaAbsenceShare([{ subject: 'A', attended: 1, missed: 1, unmarked: 0 }]),
    ).toBeNull();
  });

  it('sums every linked subject', () => {
    expect(
      areaAbsenceShare([
        { subject: 'A', attended: 3, missed: 1, unmarked: 0 },
        { subject: 'B', attended: 3, missed: 1, unmarked: 0 },
      ]),
    ).toBe(25);
  });
});
