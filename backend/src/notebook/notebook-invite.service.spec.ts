import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  INVITE_CONFLICT_CODE,
  NotebookInviteService,
} from './notebook-invite.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

interface Opts {
  entry?: unknown;
  friends?: boolean;
  share?: unknown;
  existing?: unknown;
  count?: number;
}

function setup(o: Opts = {}) {
  const prisma = {
    notebookEntry: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          'entry' in o ? o.entry : { id: 'e1', title: 'Aula' },
        ),
    },
    friendship: {
      findFirst: jest
        .fn()
        .mockResolvedValue((o.friends ?? true) ? { id: 'f' } : null),
    },
    notebookShare: {
      findUnique: jest.fn().mockResolvedValue(o.share ?? null),
      create: jest
        .fn()
        .mockResolvedValue({ id: 's1', visibility: 'AUTHORIZED' }),
    },
    notebookShareAccessRequest: {
      findUnique: jest.fn().mockResolvedValue(o.existing ?? null),
      count: jest.fn().mockResolvedValue(o.count ?? 0),
      update: jest.fn().mockResolvedValue({ id: 'r1', status: 'APPROVED' }),
      upsert: jest.fn().mockResolvedValue({
        id: 'r1',
        status: 'PENDING',
        accessRole: 'EDITOR',
      }),
      findFirst: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ name: 'Ana', email: 'a@x' }),
    },
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(undefined) };
  const service = new NotebookInviteService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
  );
  return { service, prisma, push };
}

describe('NotebookInviteService', () => {
  it('nao convida quem nao e amigo (404 igual a nao existir)', async () => {
    const { service } = setup({ friends: false });
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('nao convida para nota de outra pessoa', async () => {
    const { service } = setup({ entry: null });
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('link PUBLIC: pede para passar a Authorized', async () => {
    const { service } = setup({
      share: { id: 's1', visibility: 'PUBLIC' },
    });
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toMatchObject({
      response: { code: INVITE_CONFLICT_CODE.needsAuthorized },
    });
  });

  it('sem partilha: cria AUTHORIZED, convite PENDING e avisa o convidado', async () => {
    const { service, prisma, push } = setup();
    const res = await service.invite('o', 'e1', 'x', 'EDITOR');
    expect(prisma.notebookShare.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ visibility: 'AUTHORIZED' }) as unknown,
    });
    expect(res.status).toBe('PENDING');
    const arg = (
      prisma.notebookShareAccessRequest.upsert.mock.calls as [
        { create: { invitedByOwner: boolean; status: string } },
      ][]
    )[0][0];
    expect(arg.create).toMatchObject({
      invitedByOwner: true,
      status: 'PENDING',
    });
    expect(push.notifyUser).toHaveBeenCalledWith(
      'x',
      'shareInvited',
      expect.anything() as unknown,
    );
  });

  it('recusou ha pouco: cooldown', async () => {
    const { service } = setup({
      share: { id: 's1', visibility: 'AUTHORIZED' },
      existing: {
        status: 'DENIED',
        invitedByOwner: true,
        decidedAt: new Date(),
      },
    });
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toMatchObject({
      response: { code: INVITE_CONFLICT_CODE.declinedRecently },
    });
  });

  it('limite de pessoas por nota', async () => {
    const { service } = setup({
      share: { id: 's1', visibility: 'AUTHORIZED' },
      count: 30,
    });
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.invite('o', 'e1', 'x', 'EDITOR'),
    ).rejects.toMatchObject({
      response: { code: INVITE_CONFLICT_CODE.noteFull },
    });
  });

  it('responder: so o convidado, so convite pendente', async () => {
    const { service, prisma } = setup();
    prisma.notebookShareAccessRequest.findFirst.mockResolvedValue(null);
    await expect(service.respond('u', 'r1', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const where = (
      prisma.notebookShareAccessRequest.findFirst.mock.calls as [
        { where: Record<string, unknown> },
      ][]
    )[0][0].where;
    expect(where).toMatchObject({
      requestingUserId: 'u',
      invitedByOwner: true,
      status: 'PENDING',
    });
  });

  it('aceitar avisa o dono; recusar nao', async () => {
    const { service, prisma, push } = setup();
    prisma.notebookShareAccessRequest.findFirst.mockResolvedValue({
      id: 'r1',
      notebookShare: {
        token: 't',
        createdByUserId: 'o',
        notebookEntry: { title: 'Aula' },
      },
    });
    prisma.notebookShareAccessRequest.update.mockResolvedValue({
      id: 'r1',
      status: 'DENIED',
    });
    await service.respond('u', 'r1', false);
    expect(push.notifyUser).not.toHaveBeenCalled();
    await service.respond('u', 'r1', true);
    expect(push.notifyUser).toHaveBeenCalledWith(
      'o',
      'shareInviteAccepted',
      expect.anything() as unknown,
    );
  });

  it('aceitar depois de deixarem de ser amigos falha', async () => {
    const { service, prisma } = setup({ friends: false });
    prisma.notebookShareAccessRequest.findFirst.mockResolvedValue({
      id: 'r1',
      notebookShare: { token: 't', createdByUserId: 'o' },
    });
    await expect(service.respond('u', 'r1', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remover acesso exige ser o dono da partilha', async () => {
    const { service, prisma } = setup();
    await service.removeAccess('o', 'e1', 'r1');
    const where = (
      prisma.notebookShareAccessRequest.deleteMany.mock.calls as [
        { where: { notebookShare: unknown } },
      ][]
    )[0][0].where;
    expect(where.notebookShare).toEqual({
      notebookEntryId: 'e1',
      createdByUserId: 'o',
    });
  });
});
