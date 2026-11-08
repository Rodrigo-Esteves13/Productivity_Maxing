import { loadAreaGradeFractions } from './area-grade-fractions';
import type { PrismaService } from '../prisma/prisma.service';

const USER = 'user-1';

function prismaWith(roundInterimGrades: boolean) {
  const prisma = {
    task: {
      findMany: jest.fn().mockResolvedValue([
        {
          realGrade: 15.5,
          weightPercentage: 50,
          areaId: 'a',
          periodId: 'p1',
          title: 'Exam',
          recurrenceFrequency: null,
        },
      ]),
    },
    gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
    academicPeriod: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'p1', program: { gradeScale: '0-20', roundInterimGrades } },
        ]),
    },
  };
  return prisma;
}

describe('loadAreaGradeFractions roundInterimGrades', () => {
  it('rounds each interim grade on its own scale before normalising when on', async () => {
    const prisma = prismaWith(true);
    const result = await loadAreaGradeFractions(
      prisma as unknown as PrismaService,
      USER,
    );
    // 15.5 -> 16 on 0-20 -> 0.8
    expect(result.get('a')?.average).toBeCloseTo(0.8, 5);
    expect(result.get('a')?.count).toBe(1);
  });

  it('leaves the grades untouched when off', async () => {
    const prisma = prismaWith(false);
    const result = await loadAreaGradeFractions(
      prisma as unknown as PrismaService,
      USER,
    );
    // 15.5 on 0-20 -> 0.775, kept at 2 decimals by computeWeightedAverage.
    expect(result.get('a')?.average).toBeGreaterThan(0.76);
    expect(result.get('a')?.average).toBeLessThan(0.79);
  });

  it('reads the flag through the user-scoped period query', async () => {
    const prisma = prismaWith(false);
    await loadAreaGradeFractions(prisma as unknown as PrismaService, USER);
    expect(prisma.academicPeriod.findMany).toHaveBeenCalledWith({
      where: { program: { userId: USER } },
      select: {
        id: true,
        program: { select: { gradeScale: true, roundInterimGrades: true } },
      },
    });
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER, realGrade: { not: null } },
      }),
    );
  });
});
