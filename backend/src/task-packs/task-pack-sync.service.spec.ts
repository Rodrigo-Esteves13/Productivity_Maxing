// PushService e TasksService puxam dependencias ESM que o jest nao transforma;
// aqui so interessa que exista.
jest.mock('../push/push.service', () => ({ PushService: class {} }));
jest.mock('../tasks/tasks.service', () => ({ TasksService: class {} }));

import { NotFoundException } from '@nestjs/common';
import { TaskPackSyncService, diffShared } from './task-pack-sync.service';
import type { PackSharedFields } from './task-pack-sync.service';

const base: PackSharedFields = {
  title: 'Relatorio',
  date: '2026-11-20T00:00:00.000Z',
  weightPercentage: 20,
  effort: null,
  dateCertainty: 'UNKNOWN',
  availableFrom: null,
  isBlocked: false,
};

describe('diffShared', () => {
  it('so devolve os campos que mudaram, com o valor novo', () => {
    expect(
      diffShared(base, {
        ...base,
        date: '2026-11-27T00:00:00.000Z',
        dateCertainty: 'EXACT',
      }),
    ).toEqual({ date: '2026-11-27T00:00:00.000Z', dateCertainty: 'EXACT' });
  });

  it('sem alteracoes devolve vazio', () => {
    expect(diffShared(base, { ...base })).toEqual({});
  });
});

describe('TaskPackSyncService (posse)', () => {
  const prisma = {
    taskPack: { findFirst: jest.fn() },
    taskPackItem: { findMany: jest.fn().mockResolvedValue([]) },
    taskPackUpdate: { findFirst: jest.fn() },
  };
  const tasks = { update: jest.fn() };
  const push = { notifyUserOnce: jest.fn() };
  const service = new TaskPackSyncService(
    prisma as never,
    tasks as never,
    push as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('publish procura o pacote pelo id E pelo dono', async () => {
    prisma.taskPack.findFirst.mockResolvedValue(null);
    await expect(service.publish('intruso', 'pack-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // A ligacao dos pacotes antigos so mexe em itens de pacotes do proprio dono.
    expect(prisma.taskPackItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          packId: 'pack-1',
          pack: { ownerId: 'intruso' },
          sourceTaskId: null,
        },
      }),
    );
    expect(prisma.taskPack.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pack-1', ownerId: 'intruso' },
      }),
    );
  });

  it('accept so encontra pedidos PENDING do proprio user e nunca mexe na task de outro', async () => {
    prisma.taskPackUpdate.findFirst.mockResolvedValue(null);
    await expect(service.accept('intruso', 'upd-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.taskPackUpdate.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'upd-1', userId: 'intruso', status: 'PENDING' },
      }),
    );
    expect(tasks.update).not.toHaveBeenCalled();
  });
});
