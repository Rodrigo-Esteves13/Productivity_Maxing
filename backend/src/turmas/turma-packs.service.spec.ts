import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TurmaRole } from '@prisma/client';
import { TurmaAccessService } from './turma-access.service';
import { TurmaPacksService } from './turma-packs.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

// PushService puxa o web-push (ESM); aqui so interessa que e chamado.
jest.mock('../push/push.service', () => ({ PushService: jest.fn() }));

const member = (role: TurmaRole) => ({
  role,
  turma: { id: 't1', name: 'Turma', membersCanEditNotes: true },
});

function setup() {
  const prisma = {
    turmaMember: {
      findUnique: jest.fn().mockResolvedValue(member(TurmaRole.MEMBER)),
      findMany: jest.fn().mockResolvedValue([{ userId: 'u2' }]),
    },
    taskPack: { findFirst: jest.fn() },
    turmaPack: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'link-1' }),
      delete: jest.fn(),
    },
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(undefined) };
  const access = new TurmaAccessService(prisma as unknown as PrismaService);
  const service = new TurmaPacksService(
    prisma as unknown as PrismaService,
    access,
    push as unknown as PushService,
  );
  return { prisma, push, service };
}

describe('TurmaPacksService', () => {
  it('a non-member gets 404', async () => {
    const { prisma, service } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(null);
    await expect(service.list('u1', 't1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('only the pack owner can share it (someone else pack = 404)', async () => {
    const { prisma, service } = setup();
    prisma.taskPack.findFirst.mockResolvedValue(null);
    await expect(service.share('u1', 't1', 'p1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taskPack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1', ownerId: 'u1' } }),
    );
    expect(prisma.turmaPack.create).not.toHaveBeenCalled();
  });

  it('sharing notifies the other members', async () => {
    const { prisma, push, service } = setup();
    prisma.taskPack.findFirst.mockResolvedValue({ id: 'p1', name: 'Redes' });
    await service.share('u1', 't1', 'p1');
    expect(prisma.turmaPack.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { turmaId: 't1', packId: 'p1', sharedById: 'u1' },
      }),
    );
    expect(push.notifyUser).toHaveBeenCalledWith(
      'u2',
      'turmaPackShared',
      expect.objectContaining({ title: 'Redes' }),
    );
  });

  it('a member cannot remove a pack someone else shared', async () => {
    const { prisma, service } = setup();
    prisma.turmaPack.findFirst.mockResolvedValue({
      id: 'link-1',
      sharedById: 'other',
    });
    await expect(service.unshare('u1', 't1', 'link-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.turmaPack.delete).not.toHaveBeenCalled();
  });

  it('the delegado can remove any pack', async () => {
    const { prisma, service } = setup();
    prisma.turmaMember.findUnique.mockResolvedValue(member(TurmaRole.DELEGADO));
    prisma.turmaPack.findFirst.mockResolvedValue({
      id: 'link-1',
      sharedById: 'other',
    });
    await service.unshare('u1', 't1', 'link-1');
    expect(prisma.turmaPack.delete).toHaveBeenCalledWith({
      where: { id: 'link-1' },
    });
  });
});
