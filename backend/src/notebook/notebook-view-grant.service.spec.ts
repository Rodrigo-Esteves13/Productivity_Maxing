import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotebookViewGrantService } from './notebook-view-grant.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { SocialService } from '../social/social.service';
import type { NotebookService } from './notebook.service';

// `file-type` e ESM-only e o Jest (CJS) nao o consegue carregar; o servico
// importado transitivamente (NotebookService) nao o usa nestes testes.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

type Mock = jest.Mock;

function setup(opts: { friends?: boolean; grant?: unknown } = {}) {
  const prisma = {
    notebookViewGrant: {
      findUnique: jest.fn().mockResolvedValue(opts.grant ?? null),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    notebookEntry: {
      groupBy: jest
        .fn()
        .mockResolvedValue([{ areaId: 'a1', _count: { _all: 2 } }]),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    area: {
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: 'a1', name: 'Redes', colorHex: null }]),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Ana' }) },
  };
  const social = {
    areFriends: jest.fn().mockResolvedValue(opts.friends ?? true),
  };
  const service = new NotebookViewGrantService(
    prisma as unknown as PrismaService,
    social as unknown as SocialService,
    {} as unknown as NotebookService,
    { notifyUser: jest.fn() } as unknown as PushService,
  );
  return { service, prisma, social };
}

const approved = { status: 'APPROVED', areaIds: ['a1'] };

describe('NotebookViewGrantService', () => {
  it('only friends can request (404 otherwise)', async () => {
    const { service, prisma } = setup({ friends: false });
    await expect(service.request('me', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.notebookViewGrant.create).not.toHaveBeenCalled();
  });

  it('a denied request is shown as pending and not repeated', async () => {
    const { service, prisma } = setup({ grant: { status: 'DENIED' } });
    await expect(service.request('me', 'x')).resolves.toEqual({
      status: 'PENDING',
    });
    expect(prisma.notebookViewGrant.create).not.toHaveBeenCalled();
  });

  it('approving needs subjects that belong to the owner', async () => {
    const { service, prisma } = setup();
    prisma.notebookViewGrant.findFirst.mockResolvedValue({
      id: 'g',
      viewerId: 'v',
      status: 'PENDING',
    });
    await expect(service.decide('me', 'g', true, [])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.decide('me', 'g', true, ['not-mine']),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.decide('me', 'g', true, ['a1']);
    expect(prisma.notebookViewGrant.update).toHaveBeenCalledTimes(1);
  });

  it('only the owner decides (404 for others)', async () => {
    const { service, prisma } = setup();
    prisma.notebookViewGrant.findFirst.mockResolvedValue(null);
    await expect(
      service.decide('intruder', 'g', false, undefined),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reading is blocked without an approved grant or once no longer friends', async () => {
    await expect(setup().service.listFor('v', 'o')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      setup({ grant: { status: 'PENDING', areaIds: [] } }).service.listFor(
        'v',
        'o',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      setup({ grant: approved, friends: false }).service.listFor('v', 'o'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only entries of the approved subjects are queried', async () => {
    const { service, prisma } = setup({ grant: approved });
    await service.listFor('v', 'o');
    const args = (prisma.notebookEntry.findMany as Mock).mock.calls as [
      { where: unknown },
    ][];
    expect(args[0][0].where).toEqual({ userId: 'o', areaId: { in: ['a1'] } });
  });

  it('an entry outside the approved subjects is a 404', async () => {
    const { service } = setup({ grant: approved });
    await expect(service.getEntryFor('v', 'o', 'e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('quem pediu nao consegue apagar uma recusa', async () => {
    const { service, prisma } = setup();
    (prisma.notebookViewGrant.deleteMany as Mock).mockResolvedValue({
      count: 0,
    });
    await expect(service.remove('viewer', 'g1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const where = (
      (prisma.notebookViewGrant.deleteMany as Mock).mock.calls as [
        { where: { OR: unknown[] } },
      ][]
    )[0][0].where;
    expect(where.OR).toContainEqual({
      viewerId: 'viewer',
      status: { not: 'DENIED' },
    });
  });
});
