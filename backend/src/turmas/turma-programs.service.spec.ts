import { GradeAggregation } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { buildSnapshot, TurmaProgramsService } from './turma-programs.service';
import { MAX_PRIVATE_AREAS_PER_USER } from '../areas/areas.constants';
import { MAX_PROGRAMS_PER_USER } from '../academic-programs/academic-programs.constants';

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

describe('TurmaProgramsService.import limits', () => {
  const course = (name: string) => ({
    name,
    colorHex: '#123456',
    credits: null,
    components: [],
  });
  const snapshotOf = (names: string[]) => ({
    gradeScale: '0-20',
    roundFinalGrade: true,
    periods: [
      {
        name: 'S1',
        startDate: '2024-09-15T00:00:00.000Z',
        endDate: null,
        roundFinalGrade: null,
        courses: names.map(course),
      },
    ],
  });

  function build(ownNames: string[], programs: number, names: string[]) {
    const prisma = {
      turmaProgram: {
        findFirst: jest.fn().mockResolvedValue({
          name: 'Prog',
          snapshot: snapshotOf(names),
        }),
      },
      area: {
        findMany: jest
          .fn()
          .mockResolvedValue(
            ownNames.map((n, i) => ({ id: `a${i}`, name: n })),
          ),
      },
      academicProgram: { count: jest.fn().mockResolvedValue(programs) },
      $transaction: jest.fn().mockResolvedValue({ programId: 'p' }),
    };
    const access = { requireMember: jest.fn().mockResolvedValue({}) };
    const service = new TurmaProgramsService(prisma as never, access as never);
    return { service, prisma };
  }

  const manyNames = (n: number, prefix: string) =>
    Array.from({ length: n }, (_, i) => `${prefix}${i}`);

  it('refuses when existing private areas plus new ones exceed the cap', async () => {
    const own = manyNames(MAX_PRIVATE_AREAS_PER_USER - 1, 'own');
    const { service, prisma } = build(own, 0, ['new1', 'new2']);
    await expect(service.import('u', 't', 'l')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not count courses that reuse an own area', async () => {
    const own = manyNames(MAX_PRIVATE_AREAS_PER_USER, 'own');
    const { service, prisma } = build(own, 0, ['OWN0', 'own1']);
    await service.import('u', 't', 'l');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('refuses when the user is at the program cap', async () => {
    const { service, prisma } = build([], MAX_PROGRAMS_PER_USER, ['x']);
    await expect(service.import('u', 't', 'l')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
