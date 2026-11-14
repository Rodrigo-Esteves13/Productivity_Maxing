import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { assertBlockerValid, unblockDependents } from './task-blocker';

interface Row {
  progressStatus: string;
  blockedByTaskId: string | null;
}

function prismaWith(rows: Record<string, Row>) {
  return {
    task: {
      findFirst: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows[where.id] ?? null),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
  };
}

describe('assertBlockerValid', () => {
  it('rejects a task waiting for itself', async () => {
    const prisma = prismaWith({});
    await expect(
      assertBlockerValid(prisma as unknown as PrismaService, 'u', 'a', 'a'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a blocker the user does not own or that does not exist', async () => {
    const prisma = prismaWith({});
    await expect(
      assertBlockerValid(prisma as unknown as PrismaService, 'u', 'a', 'x'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a cycle through the chain', async () => {
    const prisma = prismaWith({
      b: { progressStatus: 'NOT_STARTED', blockedByTaskId: 'c' },
      c: { progressStatus: 'NOT_STARTED', blockedByTaskId: 'a' },
    });
    await expect(
      assertBlockerValid(prisma as unknown as PrismaService, 'u', 'a', 'b'),
    ).rejects.toThrow('wait for each other');
  });

  it('reports whether the blocker is still open', async () => {
    const prisma = prismaWith({
      open: { progressStatus: 'ON_TRACK', blockedByTaskId: null },
      done: { progressStatus: 'COMPLETED', blockedByTaskId: null },
    });
    const p = prisma as unknown as PrismaService;
    await expect(assertBlockerValid(p, 'u', 'a', 'open')).resolves.toEqual({
      blockerOpen: true,
    });
    await expect(
      assertBlockerValid(p, 'u', undefined, 'done'),
    ).resolves.toEqual({
      blockerOpen: false,
    });
  });
});

describe('unblockDependents', () => {
  it('unblocks only this user tasks waiting for the finished one', async () => {
    const prisma = prismaWith({});
    const count = await unblockDependents(
      prisma as unknown as PrismaService,
      'u1',
      't1',
    );
    expect(count).toBe(2);
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', blockedByTaskId: 't1', isBlocked: true },
      data: { isBlocked: false },
    });
  });
});
