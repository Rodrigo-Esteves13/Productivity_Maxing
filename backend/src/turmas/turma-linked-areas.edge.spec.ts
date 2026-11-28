jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('../push/push.service', () => ({ PushService: jest.fn() }));
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TurmaLinkedAreasService } from './turma-linked-areas.service';

const OWNER = 'user-owner';
const OTHER = 'user-other';
const TURMA = 'turma-1';
const AREA = 'area-1';

function setup() {
  const prisma = {
    area: { findFirst: jest.fn().mockResolvedValue({ id: AREA }) },
    turmaLinkedArea: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ id: 'l1' }),
      findFirst: jest.fn(),
      delete: jest.fn().mockResolvedValue({}),
    },
    notebookEntry: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue({ role: 'MEMBER' }),
    assertDelegadoOrAuthor: jest.fn(),
  };
  const notebook = { buildSharedEntryView: jest.fn() };
  const service = new TurmaLinkedAreasService(
    prisma as never,
    access as never,
    notebook as never,
  );
  return { service, prisma, access, notebook };
}

const LINK = {
  id: 'l1',
  userId: OWNER,
  areaId: AREA,
  user: { name: 'Owner' },
};

describe('TurmaLinkedAreasService.link edge cases', () => {
  it('non member is rejected before touching areas', async () => {
    const { service, prisma, access } = setup();
    access.requireMember.mockRejectedValue(new ForbiddenException());
    await expect(service.link(OTHER, TURMA, AREA)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.area.findFirst).not.toHaveBeenCalled();
    expect(prisma.turmaLinkedArea.upsert).not.toHaveBeenCalled();
  });

  it('area private of someone else gives NotFound and no upsert', async () => {
    const { service, prisma } = setup();
    prisma.area.findFirst.mockResolvedValue(null);
    await expect(service.link(OTHER, TURMA, AREA)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.area.findFirst).toHaveBeenCalledWith({
      where: { id: AREA, OR: [{ ownerId: null }, { ownerId: OTHER }] },
      select: { id: true },
    });
    expect(prisma.turmaLinkedArea.upsert).not.toHaveBeenCalled();
  });

  it('rejects when member is at the cap and counts only own links', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.count.mockResolvedValue(20);
    await expect(service.link(OWNER, TURMA, AREA)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.turmaLinkedArea.count).toHaveBeenCalledWith({
      where: { turmaId: TURMA, userId: OWNER },
    });
    expect(prisma.turmaLinkedArea.upsert).not.toHaveBeenCalled();
  });

  it('relinking an already linked subject at the cap succeeds without writing', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.findUnique.mockResolvedValue({ id: 'l1' });
    prisma.turmaLinkedArea.count.mockResolvedValue(20);
    await expect(service.link(OWNER, TURMA, AREA)).resolves.toEqual({
      id: 'l1',
    });
    expect(prisma.turmaLinkedArea.findUnique).toHaveBeenCalledWith({
      where: {
        turmaId_userId_areaId: { turmaId: TURMA, userId: OWNER, areaId: AREA },
      },
      select: { id: true },
    });
    expect(prisma.turmaLinkedArea.upsert).not.toHaveBeenCalled();
  });

  it('one below the cap still links, keyed by caller', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.count.mockResolvedValue(19);
    await expect(service.link(OWNER, TURMA, AREA)).resolves.toEqual({
      id: 'l1',
    });
    expect(prisma.turmaLinkedArea.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          turmaId_userId_areaId: {
            turmaId: TURMA,
            userId: OWNER,
            areaId: AREA,
          },
        },
        create: { turmaId: TURMA, userId: OWNER, areaId: AREA },
      }),
    );
  });
});

describe('TurmaLinkedAreasService.unlink', () => {
  it('missing link in this turma gives NotFound, scoped by turmaId', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(null);
    await expect(service.unlink(OWNER, TURMA, 'l1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.turmaLinkedArea.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'l1', turmaId: TURMA } }),
    );
    expect(prisma.turmaLinkedArea.delete).not.toHaveBeenCalled();
  });

  it('non author non delegado gets Forbidden and link survives', async () => {
    const { service, prisma, access } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(LINK);
    access.assertDelegadoOrAuthor.mockImplementation(() => {
      throw new ForbiddenException();
    });
    await expect(service.unlink(OTHER, TURMA, 'l1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(access.assertDelegadoOrAuthor).toHaveBeenCalledWith(
      { role: 'MEMBER' },
      OTHER,
      OWNER,
    );
    expect(prisma.turmaLinkedArea.delete).not.toHaveBeenCalled();
  });

  it('author unlinks own subject', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(LINK);
    await expect(service.unlink(OWNER, TURMA, 'l1')).resolves.toEqual({
      deleted: true,
    });
    expect(prisma.turmaLinkedArea.delete).toHaveBeenCalledWith({
      where: { id: 'l1' },
    });
  });
});

describe('TurmaLinkedAreasService entries', () => {
  it('listEntries never returns private entries and uses owner of the link', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(LINK);
    prisma.notebookEntry.findMany.mockResolvedValue([
      {
        id: 'e1',
        title: 'T',
        entryType: 'CLASS',
        classNumber: 1,
        date: new Date('2026-03-01T00:00:00Z'),
      },
    ]);
    const result = await service.listEntries(OTHER, TURMA, 'l1');
    expect(prisma.notebookEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: OWNER, areaId: AREA, privateFromFriends: false },
        take: 200,
      }),
    );
    expect(result[0].date).toBe('2026-03-01T00:00:00.000Z');
  });

  it('listEntries non member is rejected before link lookup', async () => {
    const { service, prisma, access } = setup();
    access.requireMember.mockRejectedValue(new ForbiddenException());
    await expect(
      service.listEntries(OTHER, TURMA, 'l1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.turmaLinkedArea.findFirst).not.toHaveBeenCalled();
  });

  it('listEntries unknown link gives NotFound', async () => {
    const { service, prisma } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(null);
    await expect(service.listEntries(OTHER, TURMA, 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.notebookEntry.findMany).not.toHaveBeenCalled();
  });

  it('getEntry private or missing entry is NotFound', async () => {
    const { service, prisma, notebook } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(LINK);
    prisma.notebookEntry.findFirst.mockResolvedValue(null);
    await expect(
      service.getEntry(OTHER, TURMA, 'l1', 'e1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.notebookEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'e1',
          userId: OWNER,
          areaId: AREA,
          privateFromFriends: false,
        },
      }),
    );
    expect(notebook.buildSharedEntryView).not.toHaveBeenCalled();
  });

  it('getEntry returns owner name and shared view', async () => {
    const { service, prisma, notebook } = setup();
    prisma.turmaLinkedArea.findFirst.mockResolvedValue(LINK);
    const entry = { id: 'e1' };
    prisma.notebookEntry.findFirst.mockResolvedValue(entry);
    notebook.buildSharedEntryView.mockResolvedValue({ view: true });
    await expect(service.getEntry(OTHER, TURMA, 'l1', 'e1')).resolves.toEqual({
      ownerName: 'Owner',
      entry: { view: true },
    });
    expect(notebook.buildSharedEntryView).toHaveBeenCalledWith(entry);
  });

  it('getEntry non member is rejected', async () => {
    const { service, access } = setup();
    access.requireMember.mockRejectedValue(new ForbiddenException());
    await expect(
      service.getEntry(OTHER, TURMA, 'l1', 'e1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
