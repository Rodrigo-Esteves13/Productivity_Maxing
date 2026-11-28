// TasksService e PushService puxam dependencias ESM que o jest nao transforma.
jest.mock('../push/push.service', () => ({ PushService: class {} }));
jest.mock('../tasks/tasks.service', () => ({ TasksService: class {} }));

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskPackItemsService } from './task-pack-items.service';
import { MAX_PACK_ITEMS } from './task-packs.constants';

const DUE = new Date('2026-11-20T00:00:00.000Z');

function item(id: string, sourceTaskId: string | null, position = 0) {
  return {
    id,
    position,
    title: 'Relatorio',
    dueDate: DUE,
    weightPercentage: 20,
    areaName: 'Redes',
    effort: null,
    dateCertainty: 'EXACT',
    availableFrom: null,
    isBlocked: false,
    submissionDate: null as Date | null,
    version: 1,
    sourceTaskId,
    sourceTask: sourceTaskId ? { userId: 'owner' } : null,
  };
}

function setup(items = [item('i1', 't1'), item('i2', null, 1)]) {
  const prisma = {
    taskPack: {
      findFirst: jest.fn(({ where }: { where: { ownerId: string } }) =>
        Promise.resolve(
          where.ownerId === 'owner'
            ? { id: 'p1', name: 'P', owner: { name: 'Ana' }, items }
            : null,
        ),
      ),
    },
    taskPackItem: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const tasks = { update: jest.fn().mockResolvedValue({}) };
  const result = { updatedItems: 1, proposalsCreated: 2 };
  const sync = {
    linkLegacyItems: jest.fn().mockResolvedValue(undefined),
    publishItems: jest.fn().mockResolvedValue(result),
    propagate: jest.fn().mockResolvedValue(result),
  };
  const service = new TaskPackItemsService(
    prisma as never,
    tasks as never,
    sync as never,
  );
  return { prisma, tasks, sync, service };
}

describe('TaskPackItemsService', () => {
  it('um pacote de outro user da 404 em todas as operacoes, sem escrever', async () => {
    const { prisma, tasks, sync, service } = setup();
    for (const call of [
      () => service.list('intruso', 'p1'),
      () => service.add('intruso', 'p1', { taskIds: ['t9'] }),
      () => service.update('intruso', 'p1', 'i1', { title: 'x' }),
      () => service.remove('intruso', 'p1', 'i1'),
    ]) {
      await expect(call()).rejects.toBeInstanceOf(NotFoundException);
    }
    expect(prisma.taskPackItem.createMany).not.toHaveBeenCalled();
    expect(prisma.taskPackItem.deleteMany).not.toHaveBeenCalled();
    expect(tasks.update).not.toHaveBeenCalled();
    expect(sync.linkLegacyItems).not.toHaveBeenCalled();
  });

  it('item que nao e do pacote da 404', async () => {
    const { service } = setup();
    await expect(
      service.update('owner', 'p1', 'outro', { title: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('owner', 'p1', 'outro')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('com task de origem edita a task do dono e publica so esse item', async () => {
    const { tasks, sync, service } = setup();
    await service.update('owner', 'p1', 'i1', { title: 'Novo' });
    expect(tasks.update).toHaveBeenCalledWith(
      'owner',
      't1',
      { title: 'Novo' },
      { countPostpone: false },
    );
    expect(sync.publishItems).toHaveBeenCalledWith('owner', 'p1', ['i1']);
    expect(sync.propagate).not.toHaveBeenCalled();
  });

  it('sem origem propaga a diferenca mantendo o mesmo item', async () => {
    const { tasks, sync, service } = setup();
    await service.update('owner', 'p1', 'i2', { weightPercentage: null });
    expect(tasks.update).not.toHaveBeenCalled();
    expect(sync.propagate).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({
        item: expect.objectContaining({ id: 'i2' }) as unknown,
        itemChanges: { weightPercentage: null },
      }),
    ]);
  });

  it('sem origem, a entrega nao pode ficar depois da nova data', async () => {
    const { service, sync } = setup([
      { ...item('i2', null), submissionDate: DUE },
    ]);
    await expect(
      service.update('owner', 'p1', 'i2', { date: '2026-11-10T00:00:00.000Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sync.propagate).not.toHaveBeenCalled();
  });

  it('nao junta uma task ja no pacote nem passa o limite', async () => {
    const { prisma, service } = setup();
    await expect(
      service.add('owner', 'p1', { taskIds: ['t1'] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.add('owner', 'p1', {
        taskIds: Array.from({ length: MAX_PACK_ITEMS }, (_, i) => `n${i}`),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.taskPackItem.createMany).not.toHaveBeenCalled();
  });

  it('so junta tasks do proprio dono, no fim do pacote', async () => {
    const { prisma, service } = setup();
    await expect(
      service.add('owner', 'p1', { taskIds: ['alheia'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    prisma.task.findMany.mockResolvedValue([
      {
        id: 't9',
        title: 'T',
        date: DUE,
        area: { name: 'Redes', ownerId: 'owner' },
        areaId: 'a1',
        taskType: { key: 'ACADEMICO' },
        academicType: null,
      },
    ]);
    await service.add('owner', 'p1', { taskIds: ['t9'] });
    expect(prisma.task.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId: 'owner', id: { in: ['t9'] } },
      }),
    );
    expect(prisma.taskPackItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          packId: 'p1',
          position: 2,
          sourceTaskId: 't9',
          areaId: null,
        }),
      ],
    });
  });

  it('nao deixa o pacote vazio; remover filtra por pacote e dono', async () => {
    const single = setup([item('i1', 't1')]);
    await expect(
      single.service.remove('owner', 'p1', 'i1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    const { prisma, service } = setup();
    await service.remove('owner', 'p1', 'i2');
    expect(prisma.taskPackItem.deleteMany).toHaveBeenCalledWith({
      where: { id: 'i2', packId: 'p1', pack: { ownerId: 'owner' } },
    });
  });
});
