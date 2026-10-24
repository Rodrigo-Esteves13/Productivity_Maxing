import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskPacksService } from './task-packs.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TasksService } from '../tasks/tasks.service';

// TasksService -> TaskAttachmentsService puxa o file-type (ESM puro, o jest
// nao o carrega) e o cliente do Supabase; nenhum e usado aqui.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));

const D = new Date('2026-11-01T10:00:00.000Z');

function task(id: string, ownerId: string | null) {
  return {
    id,
    title: `T-${id}`,
    date: D,
    weightPercentage: 20,
    areaId: `area-${id}`,
    area: { name: 'Redes', ownerId },
    taskType: { key: 'ACADEMICO' },
    academicType: null,
  };
}

function setup() {
  const prisma = {
    taskPack: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(
          ({ data }: { data: { items: { create: unknown[] } } }) =>
            Promise.resolve({
              id: 'p1',
              name: 'n',
              code: 'c',
              importCount: 0,
              createdAt: D,
              _count: { items: data.items.create.length },
            }),
        ),
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    task: { findMany: jest.fn() },
    area: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const tasks = { create: jest.fn().mockResolvedValue({}) };
  const service = new TaskPacksService(
    prisma as unknown as PrismaService,
    tasks as unknown as TasksService,
  );
  return { service, prisma, tasks };
}

describe('TaskPacksService', () => {
  it('so aceita tarefas do proprio dono (ids alheios => 404)', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([task('a', null)]);
    await expect(
      service.create('me', { name: 'x', taskIds: ['a', 'b'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
    const findArgs = (
      prisma.task.findMany.mock.calls as [{ where: { userId: string } }][]
    )[0][0];
    expect(findArgs.where.userId).toBe('me');
  });

  it('guarda areaId so de Areas oficiais; pessoais ficam sem id', async () => {
    const { service, prisma } = setup();
    prisma.task.findMany.mockResolvedValue([task('a', null), task('b', 'me')]);
    await service.create('me', { name: 'x', taskIds: ['a', 'b'] });
    const createArgs = (
      prisma.taskPack.create.mock.calls as [
        {
          data: {
            items: { create: { areaId: string | null; areaName: string }[] };
          };
        },
      ][]
    )[0][0];
    const items = createArgs.data.items.create;
    expect(items[0].areaId).toBe('area-a');
    expect(items[1].areaId).toBeNull();
    expect(items[1].areaName).toBe('Redes');
  });

  describe('import', () => {
    const pack = {
      id: 'p1',
      name: 'n',
      owner: { name: 'Ana' },
      items: [
        {
          id: 'i1',
          title: 'Teste 1',
          dueDate: D,
          weightPercentage: 30,
          areaId: 'official',
          areaName: 'Redes',
          taskType: 'ACADEMICO',
          academicType: 'TESTE',
        },
        {
          id: 'i2',
          title: 'Trabalho',
          dueDate: D,
          weightPercentage: 10,
          areaId: null,
          areaName: 'Minha',
          taskType: 'ACADEMICO',
          academicType: null,
        },
      ],
    };

    it('data/peso/tipo vem do pacote e a Area oficial nao pode ser trocada', async () => {
      const { service, prisma, tasks } = setup();
      prisma.taskPack.findUnique.mockResolvedValue(pack);
      const res = await service.import('u2', 'code', {
        items: [{ itemId: 'i1', areaId: 'outra' }],
      });
      expect(res).toMatchObject({ created: 1, failed: 0 });
      expect(tasks.create).toHaveBeenCalledWith(
        'u2',
        expect.objectContaining({
          areaId: 'official',
          date: D.toISOString(),
          weightPercentage: 30,
          type: 'ACADEMICO',
          academicType: 'TESTE',
        }),
      );
      expect(prisma.taskPack.update).toHaveBeenCalledTimes(1);
    });

    it('Area pessoal exige escolha; item de outro pacote e ignorado com erro', async () => {
      const { service, prisma, tasks } = setup();
      prisma.taskPack.findUnique.mockResolvedValue(pack);
      const res = await service.import('u2', 'code', {
        items: [{ itemId: 'i2' }, { itemId: 'nao-existe' }],
      });
      expect(res.created).toBe(0);
      expect(res.results.map((r) => r.ok)).toEqual([false, false]);
      expect(tasks.create).not.toHaveBeenCalled();
      expect(prisma.taskPack.update).not.toHaveBeenCalled();
    });

    it('um erro de regra (peso>100%) nao impede as outras tarefas', async () => {
      const { service, prisma, tasks } = setup();
      prisma.taskPack.findUnique.mockResolvedValue(pack);
      tasks.create.mockRejectedValueOnce(
        new BadRequestException('Weight over 100%'),
      );
      const res = await service.import('u2', 'code', {
        items: [{ itemId: 'i1' }, { itemId: 'i2', areaId: 'mine' }],
      });
      expect(res).toMatchObject({ created: 1, failed: 1 });
      expect(res.results[0].error).toBe('Weight over 100%');
    });

    it('codigo inexistente => 404', async () => {
      const { service, prisma } = setup();
      prisma.taskPack.findUnique.mockResolvedValue(null);
      await expect(service.preview('u2', 'x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
