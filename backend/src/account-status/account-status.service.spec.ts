import { UserStatus } from '@prisma/client';
import { AccountStatusService } from './account-status.service';
import type { PrismaService } from '../prisma/prisma.service';

function setup(account: Record<string, unknown>) {
  const prisma = {
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue(account) },
    userAppeal: {
      findFirst: jest.fn().mockResolvedValue({ id: 'ap1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new AccountStatusService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('AccountStatusService.getMyStatus', () => {
  it('reads only the caller data and skips availability for ACTIVE', async () => {
    const account = {
      status: UserStatus.ACTIVE,
      suspendedUntil: null,
      statusReason: null,
      statusUpdatedAt: null,
    };
    const { service, prisma } = setup(account);
    const result = await service.getMyStatus('u1');
    expect(result).toEqual({
      ...account,
      appeal: { id: 'ap1' },
      appealAvailability: null,
    });
    expect(prisma.user.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' } }),
    );
    expect(prisma.userAppeal.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u1' } }),
    );
    expect(prisma.userAppeal.findMany).not.toHaveBeenCalled();
  });

  it('computes the appeal availability for a banned account', async () => {
    const { service } = setup({
      status: UserStatus.BANNED,
      suspendedUntil: null,
      statusReason: 'spam',
      statusUpdatedAt: new Date('2026-11-01T00:00:00Z'),
    });
    const result = await service.getMyStatus('u1');
    expect(result.appealAvailability).toEqual(
      expect.objectContaining({ appealsUsed: 0, appealsExhausted: false }),
    );
  });
});
