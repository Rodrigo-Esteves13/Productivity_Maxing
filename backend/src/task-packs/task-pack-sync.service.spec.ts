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
  submissionDate: null,
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

  it('a entrega de um trabalho em duas fases tambem vai na atualizacao', () => {
    expect(
      diffShared(base, { ...base, submissionDate: '2026-11-18T00:00:00.000Z' }),
    ).toEqual({ submissionDate: '2026-11-18T00:00:00.000Z' });
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

describe('TaskPackSyncService (queries em lote)', () => {
  const DUE = new Date('2026-11-20T00:00:00.000Z');
  const LATER = new Date('2026-11-27T00:00:00.000Z');
  const OWNER = 'owner';

  function build() {
    const prisma = {
      taskPack: { findFirst: jest.fn() },
      taskPackItem: { findMany: jest.fn(), update: jest.fn((a) => a) },
      task: { findMany: jest.fn(), updateMany: jest.fn((a) => a) },
      taskPackUpdate: { create: jest.fn((a) => a), deleteMany: jest.fn() },
      $transaction: jest.fn(() => Promise.resolve([])),
    };
    const service = new TaskPackSyncService(
      prisma as never,
      {} as never,
      { notifyUserOnce: jest.fn() } as never,
    );
    return { prisma, service };
  }

  it('publish carrega as tasks importadas de todos os itens com um so findMany', async () => {
    const { prisma, service } = build();
    prisma.taskPackItem.findMany.mockResolvedValue([]);
    const item = (id: string) => ({
      id,
      version: 1,
      title: 'T',
      dueDate: DUE,
      weightPercentage: 10,
      effort: null,
      dateCertainty: 'EXACT',
      availableFrom: null,
      isBlocked: false,
      submissionDate: null,
      sourceTask: {
        title: 'T',
        date: LATER,
        weightPercentage: 10,
        effort: null,
        dateCertainty: 'EXACT',
        availableFrom: null,
        isBlocked: false,
        submissionDate: null,
      },
    });
    prisma.taskPack.findFirst.mockResolvedValue({
      id: 'p',
      name: 'Pack',
      owner: { name: 'O' },
      items: [item('i1'), item('i2'), item('i3')],
    });
    prisma.task.findMany.mockResolvedValue([]);

    await service.publish(OWNER, 'p');

    expect(prisma.task.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { packItemId: { in: ['i1', 'i2', 'i3'] } },
      }),
    );
  });

  it('linkLegacyItems usa dois findMany e um updateMany por item com correspondencias', async () => {
    const { prisma, service } = build();
    const items = [
      { id: 'i1', title: 'A', dueDate: DUE, areaId: null, version: 1 },
      { id: 'i2', title: 'B', dueDate: DUE, areaId: null, version: 2 },
    ];
    prisma.taskPackItem.findMany.mockResolvedValue(items);
    prisma.taskPack.findFirst.mockResolvedValue(null);
    prisma.task.findMany
      .mockResolvedValueOnce([
        { id: 'src-a', title: 'A', date: DUE, areaId: null },
      ])
      .mockResolvedValueOnce([
        { id: 'o1', title: 'A', date: DUE, areaId: null },
        { id: 'o2', title: 'A', date: LATER, areaId: null },
      ]);

    await expect(service.publish(OWNER, 'p')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(prisma.task.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.task.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['o1'] }, userId: { not: OWNER }, packItemId: null },
      data: { packItemId: 'i1', packItemVersion: 1 },
    });
    expect(prisma.taskPackItem.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { sourceTaskId: 'src-a' },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
