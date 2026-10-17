import { NotebookSharedWithMeService } from './notebook-shared-with-me.service';
import type { PrismaService } from '../prisma/prisma.service';

const share = (token: string) => ({
  token,
  visibility: 'AUTHORIZED',
  createdByUserId: 'owner',
  createdBy: { name: 'Ana' },
  notebookEntry: {
    title: 'Aula 3',
    area: { name: 'Redes', colorHex: '#123456' },
  },
});

function makeService(requests: unknown[], visits: unknown[]) {
  const prisma = {
    notebookShareAccessRequest: {
      findMany: jest.fn().mockResolvedValue(requests),
    },
    shareVisit: { findMany: jest.fn().mockResolvedValue(visits) },
  };
  return {
    service: new NotebookSharedWithMeService(
      prisma as unknown as PrismaService,
    ),
    prisma,
  };
}

describe('NotebookSharedWithMeService', () => {
  it('nao revela titulo/cadeira/dono de pedidos pendentes ou recusados', async () => {
    const { service } = makeService(
      [
        {
          status: 'PENDING',
          accessRole: 'VIEWER',
          createdAt: new Date(),
          decidedAt: null,
          notebookShare: share('t1'),
        },
        {
          status: 'DENIED',
          accessRole: 'VIEWER',
          createdAt: new Date(),
          decidedAt: new Date(),
          notebookShare: share('t2'),
        },
      ],
      [],
    );
    const items = await service.list('me');
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(item.title).toBeNull();
      expect(item.areaName).toBeNull();
      expect(item.ownerName).toBeNull();
    }
  });

  it('mostra metadados quando aprovado e junta partilhas publicas visitadas sem duplicar', async () => {
    const { service } = makeService(
      [
        {
          status: 'APPROVED',
          accessRole: 'EDITOR',
          createdAt: new Date(),
          decidedAt: new Date(),
          notebookShare: share('t1'),
        },
      ],
      [
        { lastVisitAt: new Date(), notebookShare: share('t1') },
        {
          lastVisitAt: new Date(),
          notebookShare: { ...share('t3'), visibility: 'PUBLIC' },
        },
      ],
    );
    const items = await service.list('me');
    expect(items.map((i) => i.token).sort()).toEqual(['t1', 't3']);
    const approved = items.find((i) => i.token === 't1')!;
    expect(approved).toMatchObject({
      status: 'APPROVED',
      role: 'EDITOR',
      title: 'Aula 3',
      ownerName: 'Ana',
    });
    expect(items.find((i) => i.token === 't3')!.status).toBe('PUBLIC');
  });

  it('exclui as proprias partilhas na query', async () => {
    const { service, prisma } = makeService([], []);
    await service.list('me');
    const args = (
      prisma.notebookShareAccessRequest.findMany.mock.calls as [
        { where: { notebookShare: unknown } },
      ][]
    )[0][0];
    expect(args.where.notebookShare).toEqual({
      createdByUserId: { not: 'me' },
    });
  });
});
