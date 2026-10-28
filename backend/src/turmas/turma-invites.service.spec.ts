import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TurmaInvitesService } from './turma-invites.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { TurmaAccessService } from './turma-access.service';
import type { TurmasService } from './turmas.service';

// `file-type` e so ESM (vem pelo TurmasService); os testes nao validam ficheiros.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

const TURMA = 'turma-1';
const ME = 'me';
const FRIEND = 'friend';

function setup(opts: { friends?: boolean; member?: boolean } = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(
        ({ where }: { where: { id?: string; email?: string } }) =>
          Promise.resolve(
            where.id === FRIEND || where.email === 'a@b.pt'
              ? { id: FRIEND }
              : null,
          ),
      ),
    },
    friendship: {
      findFirst: jest
        .fn()
        .mockResolvedValue(opts.friends === false ? null : { id: 'f' }),
    },
    turmaMember: {
      findUnique: jest.fn().mockResolvedValue(opts.member ? { id: 'm' } : null),
    },
    turmaInvite: {
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue({ turmaId: TURMA }),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'inv', invitedBy: { name: 'Ana' } }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue({ turma: { name: 'LEI' } }),
  };
  const turmas = { addMember: jest.fn().mockResolvedValue({ id: TURMA }) };
  const push = { notifyUser: jest.fn() };
  const service = new TurmaInvitesService(
    prisma as unknown as PrismaService,
    access as unknown as TurmaAccessService,
    turmas as unknown as TurmasService,
    push as unknown as PushService,
  );
  return { service, prisma, turmas, push };
}

const member = { id: ME, role: 'USER' };
const admin = { id: ME, role: 'ADMIN' };

describe('TurmaInvitesService', () => {
  it('a member can invite a friend and the friend is notified', async () => {
    const { service, push } = setup();
    await service.invite(member, TURMA, { userId: FRIEND });
    expect(push.notifyUser).toHaveBeenCalledWith(
      FRIEND,
      'turmaInvited',
      expect.objectContaining({ title: 'LEI' }),
    );
  });

  it('a member cannot invite someone who is not a friend', async () => {
    const { service } = setup({ friends: false });
    await expect(
      service.invite(member, TURMA, { userId: FRIEND }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only admins can invite by email', async () => {
    const { service } = setup();
    await expect(
      service.invite(member, TURMA, { email: 'a@b.pt' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.invite(admin, TURMA, { email: 'a@b.pt' }),
    ).resolves.toEqual({ id: 'inv' });
  });

  it('refuses inviting someone already in the class', async () => {
    const { service } = setup({ member: true });
    await expect(
      service.invite(member, TURMA, { userId: FRIEND }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accept joins through addMember and removes the invite', async () => {
    const { service, turmas, prisma } = setup();
    await service.accept(FRIEND, 'inv');
    expect(turmas.addMember).toHaveBeenCalledWith(TURMA, FRIEND);
    expect(prisma.turmaInvite.deleteMany).toHaveBeenCalledWith({
      where: { id: 'inv', userId: FRIEND },
    });
  });

  it('cannot accept or decline someone else invite', async () => {
    const { service, prisma } = setup();
    prisma.turmaInvite.findFirst.mockResolvedValue(null);
    prisma.turmaInvite.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.accept('other', 'inv')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.decline('other', 'inv')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
