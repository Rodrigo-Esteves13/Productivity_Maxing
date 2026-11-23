import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FeedbackService, MY_FEEDBACK_PATH } from './feedback.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

const AUTHOR_ID = 'author-1';

function setup(opts: { mutedAt?: Date | null; updated?: unknown } = {}) {
  const updated = opts.updated ?? {
    id: 'f1',
    message: 'Please add dark mode',
    user: { id: AUTHOR_ID },
  };
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ feedbackMutedAt: opts.mutedAt ?? null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    feedback: {
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(updated),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new FeedbackService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
  );
  return { service, prisma, push };
}

describe('FeedbackService', () => {
  it('refuses feedback from a muted user', async () => {
    const { service, prisma } = setup({ mutedAt: new Date() });
    await expect(
      service.create(AUTHOR_ID, { category: 'IDEA', message: 'hello there' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.feedback.create).not.toHaveBeenCalled();
  });

  it('lists only the caller own feedback', async () => {
    const { service, prisma } = setup();
    await service.listMine(AUTHOR_ID);
    const [args] = prisma.feedback.findMany.mock.calls[0] as [
      { where: unknown; select: { user?: unknown } },
    ];
    expect(args.where).toEqual({ userId: AUTHOR_ID });
    // Nunca expor dados do autor/moderador ao proprio.
    expect(args.select.user).toBeUndefined();
  });

  it('deleteMine only deletes feedback owned by the caller', async () => {
    const { service, prisma } = setup();
    await service.deleteMine(AUTHOR_ID, 'f1');
    expect(prisma.feedback.deleteMany).toHaveBeenCalledWith({
      where: { id: 'f1', userId: AUTHOR_ID },
    });
  });

  it('deleteMine on someone else feedback is a 404', async () => {
    const { service, prisma } = setup();
    prisma.feedback.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.deleteMine(AUTHOR_ID, 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('reply stores the text, resolves when asked and notifies the author', async () => {
    const { service, prisma, push } = setup();
    await service.reply('f1', { message: '  Done!  ', resolve: true });
    const [{ data }] = prisma.feedback.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.adminReply).toBe('Done!');
    expect(data.isResolved).toBe(true);
    expect(data.resolution).toBe('DONE');
    expect(push.notifyUser).toHaveBeenCalledWith(
      AUTHOR_ID,
      'feedbackReplied',
      expect.objectContaining({ url: MY_FEEDBACK_PATH }),
    );
  });

  it('reject closes as REJECTED and keeps an empty reason out', async () => {
    const { service, prisma, push } = setup();
    await service.reject('f1', '   ');
    const [{ data }] = prisma.feedback.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.resolution).toBe('REJECTED');
    expect(data.isResolved).toBe(true);
    expect(data.adminReply).toBeUndefined();
    expect(push.notifyUser).toHaveBeenCalledWith(
      AUTHOR_ID,
      'feedbackRejected',
      expect.anything(),
    );
  });

  it('does not notify when the author account is gone', async () => {
    const { service, push } = setup({
      updated: { id: 'f1', message: 'x', user: null },
    });
    await service.reply('f1', { message: 'Thanks' });
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('maps a missing feedback to 404', async () => {
    const { service, prisma } = setup();
    prisma.feedback.update.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('missing', {
        code: 'P2025',
        clientVersion: 'test',
      }),
    );
    await expect(service.setResolved('nope', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('mute on an unknown user is a 404', async () => {
    const { service, prisma } = setup();
    prisma.user.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.setMuted('admin-1', 'ghost', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('an admin cannot mute themselves', async () => {
    const { service, prisma } = setup();
    await expect(
      service.setMuted('admin-1', 'admin-1', true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('an admin can mute another user', async () => {
    const { service, prisma } = setup();
    await expect(service.setMuted('admin-1', 'u2', true)).resolves.toEqual({
      userId: 'u2',
      muted: true,
    });
    expect(prisma.user.updateMany).toHaveBeenCalledTimes(1);
  });
});
