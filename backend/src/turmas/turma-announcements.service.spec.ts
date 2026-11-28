jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../push/push.service', () => ({ PushService: jest.fn() }));
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TurmaAnnouncementsService } from './turma-announcements.service';

const AUTHOR = 'user-delegado';
const MEMBER = 'user-member';
const OUTSIDER = 'user-outsider';
const TURMA = 'turma-1';

function setup() {
  const prisma = {
    turmaAnnouncement: {
      findMany: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    turmaMember: { findMany: jest.fn() },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
    requireDelegado: jest
      .fn()
      .mockResolvedValue({ turma: { id: TURMA, name: 'LEI 2' } }),
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new TurmaAnnouncementsService(
    prisma as never,
    access as never,
    push as never,
  );
  return { service, prisma, access, push };
}

describe('TurmaAnnouncementsService.list', () => {
  it('checks membership for the caller and scopes by turma', async () => {
    const { service, prisma, access } = setup();
    prisma.turmaAnnouncement.findMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'T',
        body: 'B',
        createdAt: new Date('2026-01-02T03:04:05Z'),
        author: { name: 'Ana' },
      },
      {
        id: 'a2',
        title: 'T2',
        body: 'B2',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        author: null,
      },
    ]);

    const result = await service.list(MEMBER, TURMA);

    expect(access.requireMember).toHaveBeenCalledWith(MEMBER, TURMA);
    expect(prisma.turmaAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { turmaId: TURMA }, take: 50 }),
    );
    expect(result).toEqual([
      {
        id: 'a1',
        title: 'T',
        body: 'B',
        createdAt: '2026-01-02T03:04:05.000Z',
        authorName: 'Ana',
      },
      {
        id: 'a2',
        title: 'T2',
        body: 'B2',
        createdAt: '2026-01-01T00:00:00.000Z',
        authorName: null,
      },
    ]);
  });

  it('non member is rejected before any query', async () => {
    const { service, prisma, access } = setup();
    access.requireMember.mockRejectedValue(new ForbiddenException());

    await expect(service.list(OUTSIDER, TURMA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.turmaAnnouncement.findMany).not.toHaveBeenCalled();
  });

  it('turma not found propagates NotFound', async () => {
    const { service, access } = setup();
    access.requireMember.mockRejectedValue(new NotFoundException());
    await expect(service.list(MEMBER, TURMA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('TurmaAnnouncementsService.create', () => {
  it('delegado creates with own authorId and notifies every other member', async () => {
    const { service, prisma, access, push } = setup();
    prisma.turmaAnnouncement.create.mockResolvedValue({ id: 'a1' });
    prisma.turmaMember.findMany.mockResolvedValue([
      { userId: MEMBER },
      { userId: 'user-x' },
    ]);

    const result = await service.create(AUTHOR, TURMA, {
      title: 'Exam',
      body: 'Monday',
    });

    expect(access.requireDelegado).toHaveBeenCalledWith(AUTHOR, TURMA);
    expect(prisma.turmaAnnouncement.create).toHaveBeenCalledWith({
      data: { turmaId: TURMA, authorId: AUTHOR, title: 'Exam', body: 'Monday' },
      select: { id: true },
    });
    expect(prisma.turmaMember.findMany).toHaveBeenCalledWith({
      where: { turmaId: TURMA, userId: { not: AUTHOR } },
      select: { userId: true },
    });
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
    expect(push.notifyUser).toHaveBeenCalledWith(MEMBER, 'turmaAnnouncement', {
      name: 'LEI 2',
      title: 'Exam',
      url: `/classes/${TURMA}`,
    });
    expect(push.notifyUser).not.toHaveBeenCalledWith(
      AUTHOR,
      expect.anything(),
      expect.anything(),
    );
    expect(result).toEqual({ id: 'a1' });
  });

  it('plain member gets Forbidden and nothing is written or pushed', async () => {
    const { service, prisma, access, push } = setup();
    access.requireDelegado.mockRejectedValue(new ForbiddenException());

    await expect(
      service.create(MEMBER, TURMA, { title: 't', body: 'b' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.turmaAnnouncement.create).not.toHaveBeenCalled();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('turma with no other members sends no push', async () => {
    const { service, prisma, push } = setup();
    prisma.turmaAnnouncement.create.mockResolvedValue({ id: 'a1' });
    prisma.turmaMember.findMany.mockResolvedValue([]);
    await service.create(AUTHOR, TURMA, { title: 't', body: 'b' });
    expect(push.notifyUser).not.toHaveBeenCalled();
  });
});

describe('TurmaAnnouncementsService.remove', () => {
  it('delegado deletes scoped by turmaId (no cross-turma delete)', async () => {
    const { service, prisma, access } = setup();
    prisma.turmaAnnouncement.deleteMany.mockResolvedValue({ count: 1 });

    await expect(service.remove(AUTHOR, TURMA, 'a1')).resolves.toEqual({
      deleted: true,
    });
    expect(access.requireDelegado).toHaveBeenCalledWith(AUTHOR, TURMA);
    expect(prisma.turmaAnnouncement.deleteMany).toHaveBeenCalledWith({
      where: { id: 'a1', turmaId: TURMA },
    });
  });

  it('announcement of another turma or missing gives NotFound', async () => {
    const { service, prisma } = setup();
    prisma.turmaAnnouncement.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove(AUTHOR, TURMA, 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('plain member gets Forbidden before any delete', async () => {
    const { service, prisma, access } = setup();
    access.requireDelegado.mockRejectedValue(new ForbiddenException());
    await expect(service.remove(MEMBER, TURMA, 'a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.turmaAnnouncement.deleteMany).not.toHaveBeenCalled();
  });
});
