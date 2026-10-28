import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PersonalNotesService } from './personal-notes.service';
import { PERSONAL_NOTES_PATH } from './personal-notes.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

function setup(opts: { delivered?: number; due?: unknown[] } = {}) {
  const prisma = {
    personalNote: {
      findMany: jest.fn().mockResolvedValue(opts.due ?? []),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'n1' }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const push = {
    notifyUser: jest.fn().mockResolvedValue(opts.delivered ?? 1),
  };
  const service = new PersonalNotesService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
  );
  return { service, prisma, push };
}

describe('PersonalNotesService', () => {
  it('every query is scoped to the owner', async () => {
    const { service, prisma } = setup();
    await service.update('me', 'n1', { title: 'x' });
    const [{ where }] = prisma.personalNote.updateMany.mock.calls[0] as [
      { where: unknown },
    ];
    expect(where).toEqual({
      id: 'n1',
      userId: 'me',
    });
    await service.remove('me', 'n1');
    expect(prisma.personalNote.deleteMany).toHaveBeenCalledWith({
      where: { id: 'n1', userId: 'me' },
    });
  });

  it('editing another user note is a 404', async () => {
    const { service, prisma } = setup();
    prisma.personalNote.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('me', 'theirs', { done: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a new reminder time clears remindedAt so it can fire again', async () => {
    const { service, prisma } = setup();
    await service.update('me', 'n1', { remindAt: '2026-11-01T10:00:00.000Z' });
    const [{ data }] = prisma.personalNote.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data.remindAt).toEqual(new Date('2026-11-01T10:00:00.000Z'));
    expect(data.remindedAt).toBeNull();
  });

  it('refuses reminders years ahead', async () => {
    const { service } = setup();
    await expect(
      service.create('me', { title: 'x', remindAt: '2099-01-01T00:00:00Z' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends due reminders and marks them only when delivered', async () => {
    const due = [{ id: 'n1', userId: 'u1', title: 'Pagar propinas' }];
    const { service, prisma, push } = setup({ due });
    const now = new Date('2026-10-28T09:00:00Z');
    await expect(service.sendDueReminders(now)).resolves.toBe(1);
    expect(push.notifyUser).toHaveBeenCalledWith('u1', 'selfReminder', {
      title: 'Pagar propinas',
      url: PERSONAL_NOTES_PATH,
    });
    expect(prisma.personalNote.updateMany).toHaveBeenCalledWith({
      where: { id: 'n1', remindedAt: null },
      data: { remindedAt: now },
    });
  });

  it('keeps an undelivered reminder for the next run', async () => {
    const due = [{ id: 'n1', userId: 'u1', title: 'x' }];
    const { service, prisma } = setup({ due, delivered: 0 });
    await expect(service.sendDueReminders()).resolves.toBe(0);
    expect(prisma.personalNote.updateMany).not.toHaveBeenCalled();
  });
});
