import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { LEGACY_LIST_CAP } from '../common/pagination.util';
import { MS_PER_DAY } from '../common/time.constants';
import type { PrismaService } from '../prisma/prisma.service';

// file-type e ESM puro (AuthService -> AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

function setup(users: { id: string }[] = []) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(users),
      findFirst: jest.fn().mockResolvedValue({ id: 'c1' }),
      update: jest.fn().mockResolvedValue({ id: 'u2' }),
    },
  };
  const authService = { deleteAccount: jest.fn().mockResolvedValue(undefined) };
  const accountStatus = { markBlocked: jest.fn(), clearBlocked: jest.fn() };
  const sessionState = { invalidate: jest.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    authService as never,
    accountStatus as never,
    sessionState as never,
  );
  return { service, prisma, authService, accountStatus, sessionState };
}

interface FindManyArgs {
  where: { OR?: Record<string, unknown>[] };
  orderBy: unknown;
  take: number;
  skip?: number;
  cursor?: { id: string };
}

describe('UsersService.findAll', () => {
  it('without cursor/paginated keeps the plain array shape (capped)', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }];
    const { service, prisma } = setup(rows);
    await expect(service.findAll({})).resolves.toEqual(rows);
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.take).toBe(LEGACY_LIST_CAP + 1);
    expect(args.where).toEqual({});
  });

  it('searches name, email and friend code on the server', async () => {
    const { service, prisma } = setup();
    await service.findAll({ q: '  ana  ' });
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.where.OR).toEqual([
      { name: { contains: 'ana', mode: 'insensitive' } },
      { email: { contains: 'ana', mode: 'insensitive' } },
      { friendCode: { contains: 'ana', mode: 'insensitive' } },
    ]);
  });

  it('filters by role and status and flips the join order', async () => {
    const { service, prisma } = setup();
    await service.findAll({ role: 'ADMIN', status: 'BANNED', order: 'asc' });
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.where).toEqual({ role: 'ADMIN', status: 'BANNED' });
    expect(args.orderBy).toEqual([{ createdAt: 'asc' }, { id: 'asc' }]);
  });

  it('a blank q does not filter', async () => {
    const { service, prisma } = setup();
    await service.findAll({ q: '   ' });
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.where).toEqual({});
  });

  it('paginated=true answers { items, nextCursor } with a stable order', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const { service, prisma } = setup(rows);
    const page = await service.findAll({ paginated: true, limit: 2 });
    expect(page).toEqual({
      items: [{ id: 'a' }, { id: 'b' }],
      nextCursor: 'b',
    });
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.take).toBe(3);
    expect(args.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);
  });

  it('a cursor is checked inside the same search scope', async () => {
    const { service, prisma } = setup([{ id: 'x' }]);
    await service.findAll({ cursor: 'c1', q: 'ana' });
    const [lookup] = prisma.user.findFirst.mock.calls[0] as [
      { where: { id: string; OR: unknown[] } },
    ];
    expect(lookup.where.id).toBe('c1');
    expect(lookup.where.OR).toHaveLength(3);
    const [args] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(args.cursor).toEqual({ id: 'c1' });
    expect(args.skip).toBe(1);
  });

  it('an unknown cursor is a 400', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.findAll({ cursor: 'nope' })).rejects.toThrow(
      'Invalid cursor',
    );
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});

describe('UsersService self-action rules', () => {
  it('an admin cannot demote themselves', async () => {
    const { service, prisma } = setup();
    await expect(
      service.update('a1', 'a1', { role: Role.USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('an admin can rename themselves or keep the ADMIN role', async () => {
    const { service, prisma } = setup();
    await service.update('a1', 'a1', { name: 'Novo' });
    await service.update('a1', 'a1', { role: Role.ADMIN });
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
  });

  it('an admin can change another user role and the session is invalidated', async () => {
    const { service, sessionState } = setup();
    await service.update('a1', 'u2', { role: Role.USER });
    expect(sessionState.invalidate).toHaveBeenCalledWith('u2');
  });

  it('an admin cannot suspend, ban or delete themselves', async () => {
    const { service, prisma, accountStatus, authService } = setup();
    const until = new Date(Date.now() + MS_PER_DAY).toISOString();
    await expect(
      service.suspendUser('a1', 'a1', { reason: 'x', until }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.banUser('a1', 'a1', { reason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('a1', 'a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(accountStatus.markBlocked).not.toHaveBeenCalled();
    expect(authService.deleteAccount).not.toHaveBeenCalled();
  });

  it('an admin can ban and delete another user', async () => {
    const { service, accountStatus, authService } = setup();
    await service.banUser('a1', 'u2', { reason: 'spam' });
    await service.remove('a1', 'u2');
    expect(accountStatus.markBlocked).toHaveBeenCalledWith(
      'u2',
      'BANNED',
      null,
    );
    expect(authService.deleteAccount).toHaveBeenCalledWith('u2');
  });
});

describe('UsersService.findAll sorted by name', () => {
  it('pages over the ordered ids and keeps that order', async () => {
    const { service, prisma } = setup();
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }])
      .mockResolvedValueOnce([{ id: 'c' }, { id: 'b' }]);
    prisma.user.findFirst.mockResolvedValue({ id: 'a' });

    const page = await service.findAll({ sort: 'name', cursor: 'a', limit: 5 });

    expect(page).toEqual({
      items: [{ id: 'b' }, { id: 'c' }],
      nextCursor: null,
    });
    const [ordered] = prisma.user.findMany.mock.calls[0] as [FindManyArgs];
    expect(ordered.orderBy).toEqual([
      { name: { sort: 'asc', nulls: 'last' } },
      { email: 'asc' },
      { id: 'asc' },
    ]);
  });
});
