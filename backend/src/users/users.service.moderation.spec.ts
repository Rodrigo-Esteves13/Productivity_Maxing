// suspendUser / banUser / reactivateUser: auto-acao proibida, datas invalidas,
// alvo inexistente (P2025 do Prisma propaga, o filtro global faz 404) e a
// cache de estado so se mexe depois de a BD aceitar a escrita.
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { SELF_BAN_MESSAGE, SELF_SUSPEND_MESSAGE } from './users.constants';
import { MS_PER_DAY } from '../common/time.constants';
import type { PrismaService } from '../prisma/prisma.service';

// file-type e ESM puro (AuthService -> AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

function setup() {
  const prisma = {
    user: {
      update: jest.fn().mockResolvedValue({ id: 'u2' }),
    },
  };
  const accountStatus = { markBlocked: jest.fn(), clearBlocked: jest.fn() };
  const sessionState = { invalidate: jest.fn() };
  const service = new UsersService(
    prisma as unknown as PrismaService,
    { deleteAccount: jest.fn() } as never,
    accountStatus as never,
    sessionState as never,
  );
  return { service, prisma, accountStatus };
}

const notFound = () =>
  Object.assign(new Error('No record was found'), { code: 'P2025' });

const future = () => new Date(Date.now() + 7 * MS_PER_DAY).toISOString();

describe('UsersService.suspendUser', () => {
  it('an admin cannot suspend themselves, no write, no cache change', async () => {
    const { service, prisma, accountStatus } = setup();
    const call = service.suspendUser('a1', 'a1', {
      reason: 'x',
      until: future(),
    });
    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call).rejects.toThrow(SELF_SUSPEND_MESSAGE);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(accountStatus.markBlocked).not.toHaveBeenCalled();
  });

  it('rejects an until in the past', async () => {
    const { service, prisma } = setup();
    await expect(
      service.suspendUser('a1', 'u2', {
        reason: 'x',
        until: new Date(Date.now() - 1000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects an until equal to now (must be strictly in the future)', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-01T10:00:00.000Z') });
    try {
      const { service, prisma } = setup();
      await expect(
        service.suspendUser('a1', 'u2', {
          reason: 'x',
          until: '2026-06-01T10:00:00.000Z',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects an unparseable until', async () => {
    const { service, prisma } = setup();
    await expect(
      service.suspendUser('a1', 'u2', { reason: 'x', until: 'not-a-date' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('writes SUSPENDED with until, reason and the acting admin, then marks the cache', async () => {
    const { service, prisma, accountStatus } = setup();
    const until = future();
    await service.suspendUser('a1', 'u2', { reason: 'spam', until });

    const [args] = prisma.user.update.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ id: 'u2' });
    expect(args.data).toMatchObject({
      status: UserStatus.SUSPENDED,
      suspendedUntil: new Date(until),
      statusReason: 'spam',
      statusUpdatedByUserId: 'a1',
    });
    expect(args.data.statusUpdatedAt).toBeInstanceOf(Date);
    expect(accountStatus.markBlocked).toHaveBeenCalledWith(
      'u2',
      UserStatus.SUSPENDED,
      new Date(until),
    );
  });

  it('re-suspending only rewrites the row (no stacking), same path', async () => {
    const { service, prisma, accountStatus } = setup();
    await service.suspendUser('a1', 'u2', { reason: 'a', until: future() });
    await service.suspendUser('a1', 'u2', { reason: 'b', until: future() });
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(accountStatus.markBlocked).toHaveBeenCalledTimes(2);
  });

  it('a missing target propagates P2025 and leaves the cache alone', async () => {
    const { service, prisma, accountStatus } = setup();
    prisma.user.update.mockRejectedValueOnce(notFound());
    await expect(
      service.suspendUser('a1', 'ghost', { reason: 'x', until: future() }),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect(accountStatus.markBlocked).not.toHaveBeenCalled();
  });
});

describe('UsersService.banUser', () => {
  it('an admin cannot ban themselves, no write, no cache change', async () => {
    const { service, prisma, accountStatus } = setup();
    const call = service.banUser('a1', 'a1', { reason: 'x' });
    await expect(call).rejects.toBeInstanceOf(ForbiddenException);
    await expect(call).rejects.toThrow(SELF_BAN_MESSAGE);
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(accountStatus.markBlocked).not.toHaveBeenCalled();
  });

  it('writes BANNED, clears suspendedUntil and marks the cache with a null end', async () => {
    const { service, prisma, accountStatus } = setup();
    await service.banUser('a1', 'u2', { reason: 'malware' });

    const [args] = prisma.user.update.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ id: 'u2' });
    expect(args.data).toMatchObject({
      status: UserStatus.BANNED,
      suspendedUntil: null,
      statusReason: 'malware',
      statusUpdatedByUserId: 'a1',
    });
    expect(accountStatus.markBlocked).toHaveBeenCalledWith(
      'u2',
      UserStatus.BANNED,
      null,
    );
  });

  it('banning an already suspended account turns it into a permanent ban', async () => {
    const { service, prisma } = setup();
    await service.suspendUser('a1', 'u2', { reason: 'a', until: future() });
    await service.banUser('a1', 'u2', { reason: 'b' });
    const [args] = prisma.user.update.mock.calls[1] as [
      { data: Record<string, unknown> },
    ];
    expect(args.data.status).toBe(UserStatus.BANNED);
    expect(args.data.suspendedUntil).toBeNull();
  });

  it('a missing target propagates P2025 and leaves the cache alone', async () => {
    const { service, prisma, accountStatus } = setup();
    prisma.user.update.mockRejectedValueOnce(notFound());
    await expect(
      service.banUser('a1', 'ghost', { reason: 'x' }),
    ).rejects.toMatchObject({ code: 'P2025' });
    expect(accountStatus.markBlocked).not.toHaveBeenCalled();
  });
});

describe('UsersService.reactivateUser', () => {
  it('restores ACTIVE, clears the reason and until, then clears the cache', async () => {
    const { service, prisma, accountStatus } = setup();
    await service.reactivateUser('a1', 'u2');

    const [args] = prisma.user.update.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ id: 'u2' });
    expect(args.data).toMatchObject({
      status: UserStatus.ACTIVE,
      suspendedUntil: null,
      statusReason: null,
      statusUpdatedBy: { connect: { id: 'a1' } },
    });
    expect(accountStatus.clearBlocked).toHaveBeenCalledWith('u2');
  });

  it('works on an account that is already active (idempotent, no error)', async () => {
    const { service, accountStatus } = setup();
    await service.reactivateUser('a1', 'u2');
    await service.reactivateUser('a1', 'u2');
    expect(accountStatus.clearBlocked).toHaveBeenCalledTimes(2);
  });

  it('an admin may reactivate their own row (no self guard on lifting)', async () => {
    const { service, prisma } = setup();
    await expect(service.reactivateUser('a1', 'a1')).resolves.toBeDefined();
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('a missing target propagates P2025 and does not clear the cache', async () => {
    const { service, prisma, accountStatus } = setup();
    prisma.user.update.mockRejectedValueOnce(notFound());
    await expect(service.reactivateUser('a1', 'ghost')).rejects.toMatchObject({
      code: 'P2025',
    });
    expect(accountStatus.clearBlocked).not.toHaveBeenCalled();
  });

  it('buildReactivationData always connects the acting admin and stamps the time', () => {
    const { service } = setup();
    const data = service.buildReactivationData('a9');
    expect(data.status).toBe(UserStatus.ACTIVE);
    expect(data.statusUpdatedBy).toEqual({ connect: { id: 'a9' } });
    expect(data.statusUpdatedAt).toBeInstanceOf(Date);
  });
});
