import { GradeAggregation } from '@prisma/client';
import { buildSnapshot } from './turma-programs.service';

describe('buildSnapshot', () => {
  it('groups components by period and course and never carries grades', () => {
    const snapshot = buildSnapshot(
      { gradeScale: '0-20', roundFinalGrade: true },
      [
        {
          id: 'p1',
          name: '1st semester',
          startDate: new Date('2024-09-15T00:00:00Z'),
          endDate: null,
          roundFinalGrade: null,
        },
        {
          id: 'p2',
          name: '2nd semester',
          startDate: new Date('2025-02-15T00:00:00Z'),
          endDate: null,
          roundFinalGrade: false,
        },
      ],
      [
        {
          periodId: 'p1',
          name: 'Exam',
          weightPercentage: 60,
          aggregation: GradeAggregation.AVERAGE,
          bestOfCount: null,
          expectedEntries: 1,
          area: { name: 'Redes', colorHex: '#123456', credits: 6 },
        },
        {
          periodId: 'p1',
          name: 'Project',
          weightPercentage: 40,
          aggregation: GradeAggregation.AVERAGE,
          bestOfCount: null,
          expectedEntries: null,
          area: { name: 'Redes', colorHex: '#123456', credits: 6 },
        },
      ],
    );
    expect(snapshot.periods).toHaveLength(2);
    expect(snapshot.periods[0].courses).toEqual([
      {
        name: 'Redes',
        colorHex: '#123456',
        credits: 6,
        components: [
          expect.objectContaining({ name: 'Exam', weightPercentage: 60 }),
          expect.objectContaining({ name: 'Project', weightPercentage: 40 }),
        ],
      },
    ]);
    expect(snapshot.periods[1].courses).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('score');
  });
});
