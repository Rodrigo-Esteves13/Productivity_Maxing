import { NotFoundException } from '@nestjs/common';
import { PeriodsService } from './periods.service';
import { ProgramsService } from './programs.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('PeriodsService.getReportCard', () => {
  const setup = (period: unknown) => {
    const prisma = {
      academicPeriod: { findFirst: jest.fn().mockResolvedValue(period) },
      academicProgram: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'Bachelor',
          gradeScale: '0-20',
          roundFinalGrade: false,
        }),
      },
      task: {
        findMany: jest.fn().mockResolvedValue([
          { realGrade: 14, weightPercentage: 50, areaId: 'b' },
          { realGrade: 16, weightPercentage: 50, areaId: 'b' },
          { realGrade: 8, weightPercentage: 100, areaId: 'a' },
        ]),
      },
      area: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'Algebra', credits: 6 },
          { id: 'b', name: 'Biology', credits: 6 },
        ]),
      },
      gradeComponent: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const db = prisma as unknown as PrismaService;
    return {
      prisma,
      service: new PeriodsService(db, new ProgramsService(db)),
    };
  };

  it('scopes the period lookup to the owner and 404s otherwise', async () => {
    const { prisma, service } = setup(null);
    await expect(service.getReportCard('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.academicPeriod.findFirst).toHaveBeenCalledWith({
      where: { id: 'x', program: { userId: 'u1' } },
    });
    expect(prisma.task.findMany).not.toHaveBeenCalled();
  });

  it('lists each course with pass/fail and the period average', async () => {
    const { prisma, service } = setup({
      id: 's1',
      programId: 'p1',
      name: 'Semester 1',
      startDate: new Date('2026-09-15'),
      endDate: null,
      roundFinalGrade: null,
    });
    const card = await service.getReportCard('u1', 's1');
    const [taskQuery] = prisma.task.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(taskQuery.where).toMatchObject({ userId: 'u1', periodId: 's1' });
    expect(card.areas.map((a) => [a.areaName, a.average, a.passed])).toEqual([
      ['Algebra', 8, false],
      ['Biology', 15, true],
    ]);
    expect(card.earnedCredits).toBe(6);
    expect(card.attemptedCredits).toBe(12);
    expect(card.average).toBe(11.5);
  });
});
