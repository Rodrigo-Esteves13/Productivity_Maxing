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
      }),
    );
    expect(data.profile).toMatchObject({ quietHoursStart: 1380 });
  });
});
