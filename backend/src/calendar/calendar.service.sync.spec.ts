// S-07: a posse da task e o update do eventId vivem no CalendarService.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
import { NotFoundException } from '@nestjs/common';
import { CalendarService } from './calendar.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthService } from '../auth/auth.service';

function setup(task: Record<string, unknown> | null) {
  const prisma = {
    task: {
      findFirst: jest.fn().mockResolvedValue(task),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const service = new CalendarService(
    prisma as unknown as PrismaService,
    {} as AuthService,
  );
  const upsert = jest
    .spyOn(service, 'upsertEventForTask')
    .mockResolvedValue('evt-1');
  const del = jest.spyOn(service, 'deleteEventForTask').mockResolvedValue();
  return { prisma, service, upsert, del };
}

describe('CalendarService.syncTask / unsyncTask', () => {
  it('syncTask checks ownership, upserts and stores the event id for that user', async () => {
    const { prisma, service, upsert } = setup({ id: 't1' });

    await expect(service.syncTask('u1', 't1')).resolves.toEqual({
      googleCalendarEventId: 'evt-1',
    });

    expect(
      (prisma.task.findFirst.mock.calls[0] as [{ where: unknown }])[0].where,
    ).toEqual({
      id: 't1',
      userId: 'u1',
    });
    expect(upsert).toHaveBeenCalledWith('u1', { id: 't1' });
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u1' },
      data: { googleCalendarEventId: 'evt-1' },
    });
  });

  it("syncTask on someone else's task is a 404 and never calls Google", async () => {
    const { service, upsert } = setup(null);
    await expect(service.syncTask('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(upsert).not.toHaveBeenCalled();
  });

  it('unsyncTask deletes the event and clears the id', async () => {
    const { prisma, service, del } = setup({ googleCalendarEventId: 'evt-9' });

    await expect(service.unsyncTask('u1', 't1')).resolves.toEqual({
      googleCalendarEventId: null,
    });

    expect(del).toHaveBeenCalledWith('u1', 'evt-9');
    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u1' },
      data: { googleCalendarEventId: null },
    });
  });

  it('unsyncTask without an event id does not call Google', async () => {
    const { service, del } = setup({ googleCalendarEventId: null });
    await service.unsyncTask('u1', 't1');
    expect(del).not.toHaveBeenCalled();
  });

  it("unsyncTask on someone else's task is a 404", async () => {
    const { service } = setup(null);
    await expect(service.unsyncTask('u1', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
