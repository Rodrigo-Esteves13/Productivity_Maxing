jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../push/push.service', () => ({ PushService: jest.fn() }));
import { TurmaLinkedAreasService } from './turma-linked-areas.service';

const USER_A = 'user-a';
const USER_B = 'user-b';
const TURMA = 'turma-1';

const linkRow = (id: string, userId: string, areaId: string) => ({
  id,
  userId,
  areaId,
  user: { name: userId },
  area: { name: areaId, colorHex: '#111111' },
});

function build(links: ReturnType<typeof linkRow>[]) {
  const prisma = {
    turmaLinkedArea: { findMany: jest.fn(() => Promise.resolve(links)) },
    notebookEntry: {
      count: jest.fn(),
      groupBy: jest.fn(() =>
        Promise.resolve([
          { userId: USER_A, areaId: 'area-1', _count: { _all: 3 } },
        ]),
      ),
    },
  };
  const access = { requireMember: jest.fn(() => Promise.resolve({})) };
  const service = new TurmaLinkedAreasService(
    prisma as never,
    access as never,
    {} as never,
  );
  return { service, prisma, access };
}

describe('TurmaLinkedAreasService.list', () => {
  it('counts entries of all shared subjects with one groupBy', async () => {
    const { service, prisma } = build([
      linkRow('l1', USER_A, 'area-1'),
      linkRow('l2', USER_B, 'area-2'),
    ]);

    const result = await service.list(USER_A, TURMA);

    expect(prisma.notebookEntry.count).not.toHaveBeenCalled();
    expect(prisma.notebookEntry.groupBy).toHaveBeenCalledTimes(1);
    expect(prisma.notebookEntry.groupBy).toHaveBeenCalledWith({
      by: ['userId', 'areaId'],
      where: {
        privateFromFriends: false,
        OR: [
          { userId: USER_A, areaId: 'area-1' },
          { userId: USER_B, areaId: 'area-2' },
        ],
      },
      _count: { _all: true },
    });
    expect(result.map((r) => r.entryCount)).toEqual([3, 0]);
  });

  it('skips the count query when nothing is shared', async () => {
    const { service, prisma } = build([]);
    await expect(service.list(USER_A, TURMA)).resolves.toEqual([]);
    expect(prisma.notebookEntry.groupBy).not.toHaveBeenCalled();
  });
});
