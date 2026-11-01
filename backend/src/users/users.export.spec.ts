import { UsersService } from './users.service';
import type { PrismaService } from '../prisma/prisma.service';

// file-type e ESM puro (AuthService -> AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

// E-09: o export "completo" inclui os conjuntos de dados que faltavam.
describe('UsersService.exportUserData', () => {
  it('includes schedule, grades, social, appeals, agent and settings data', async () => {
    const model = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'user-1', quietHoursStart: 1380 }),
    };
    const prisma = new Proxy({}, { get: () => model });
    const none = {} as never;
    const service = new UsersService(prisma as PrismaService, none, none, none);

    const data = await service.exportUserData('user-1');

    expect(data).toEqual(
      expect.objectContaining({
        workShifts: [],
        commitments: [],
        scheduleExceptions: [],
        classOccurrences: [],
        gradeComponents: [],
        travelTimes: [],
        taskPacks: [],
        social: { friendships: [], blocks: [], notesViewGrants: [] },
        notebookShares: [],
        feedback: [],
        appeals: [],
        agentConfig: null,
        pushSubscriptions: [],
        areaTeacherNotes: [],
        areaRatings: [],
        approvalRuleSets: [],
      }),
    );
    expect(data.profile).toMatchObject({ quietHoursStart: 1380 });
  });

  it('exports the area behind a teacher note or a course rule override', async () => {
    const areaFindMany = jest.fn().mockResolvedValue([]);
    const empty = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const models: Record<string, unknown> = {
      area: { ...empty, findMany: areaFindMany },
      areaTeacherNote: {
        ...empty,
        findMany: jest
          .fn()
          .mockResolvedValue([{ areaId: 'area-note', teacherName: 'Ana' }]),
      },
      approvalRuleSet: {
        ...empty,
        findMany: jest.fn().mockResolvedValue([
          { areaId: 'area-rule', programId: null },
          { areaId: null, programId: 'prog-1' },
        ]),
      },
    };
    const prisma = new Proxy(
      {},
      { get: (_t, key: string) => models[key] ?? empty },
    );
    const none = {} as never;
    const service = new UsersService(prisma as PrismaService, none, none, none);

    const data = await service.exportUserData('user-1');

    const calls = areaFindMany.mock.calls as [
      { where: { id?: { in: string[] } } },
    ][];
    const where = calls.map(([args]) => args.where).find((w) => w.id);
    expect(where?.id?.in.sort()).toEqual(['area-note', 'area-rule']);
    expect(data.approvalRuleSets).toHaveLength(2);
    const noteSel = (models.areaTeacherNote as { findMany: jest.Mock }).findMany
      .mock.calls[0] as [{ select: Record<string, boolean> }];
    expect(noteSel[0].select.autoFromSchedule).toBe(true);
    const ruleSel = (models.approvalRuleSet as { findMany: jest.Mock }).findMany
      .mock.calls[0] as [{ select: Record<string, boolean> }];
    expect(ruleSel[0].select.customRules).toBe(true);
  });

  it('exports only the caller area ratings and the areas behind them (N48)', async () => {
    const areaFindMany = jest.fn().mockResolvedValue([]);
    const ratingFindMany = jest.fn().mockResolvedValue([
      {
        areaId: 'area-rated',
        teacherRating: 4,
        courseLiking: null,
        updatedAt: new Date(0),
      },
    ]);
    const empty = {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'user-1' }),
    };
    const models: Record<string, unknown> = {
      area: { ...empty, findMany: areaFindMany },
      areaRating: { ...empty, findMany: ratingFindMany },
    };
    const prisma = new Proxy(
      {},
      { get: (_t, key: string) => models[key] ?? empty },
    );
    const none = {} as never;
    const service = new UsersService(prisma as PrismaService, none, none, none);

    const data = await service.exportUserData('user-1');

    expect(ratingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    );
    expect(data.areaRatings).toEqual([
      expect.objectContaining({ areaId: 'area-rated', teacherRating: 4 }),
    ]);
    const calls = areaFindMany.mock.calls as [
      { where: { id?: { in: string[] } } },
    ][];
    const where = calls.map(([args]) => args.where).find((w) => w.id);
    expect(where?.id?.in).toEqual(['area-rated']);
  });
});
