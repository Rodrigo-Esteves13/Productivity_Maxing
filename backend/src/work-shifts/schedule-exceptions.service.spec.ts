import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ScheduleExceptionsService } from './schedule-exceptions.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateScheduleExceptionDto } from './dto/schedule-exception.dto';

function setup(shift: { dayOfWeek: number | null } | null = { dayOfWeek: 1 }) {
  const prisma = {
    workShift: { findFirst: jest.fn().mockResolvedValue(shift) },
    commitment: { count: jest.fn().mockResolvedValue(1) },
    scheduleException: {
      count: jest.fn().mockResolvedValue(0),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: unknown }) =>
          Promise.resolve(data),
        ),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ id: 'e1' }),
    },
  };
  return {
    service: new ScheduleExceptionsService(prisma as unknown as PrismaService),
    prisma,
  };
}

const base: CreateScheduleExceptionDto = {
  kind: 'OFF',
  startsOn: '2026-11-02',
  endsOn: '2026-11-08',
};

describe('ScheduleExceptionsService.create', () => {
  it('holidays from every weekly shift need no target', async () => {
    const { service, prisma } = setup();
    await service.create('u1', base);
    expect(prisma.scheduleException.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          shiftId: null,
          commitmentId: null,
        }) as unknown,
      }),
    );
  });

  it('a new time needs a weekly shift and a valid time', async () => {
    const { service } = setup();
    await expect(
      service.create('u1', {
        ...base,
        kind: 'RETIME',
        startMinutes: 600,
        endMinutes: 700,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('u1', {
        ...base,
        kind: 'RETIME',
        shiftId: 's1',
        startMinutes: 700,
        endMinutes: 600,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('one-off shifts are edited, not excepted', async () => {
    const { service } = setup({ dayOfWeek: null });
    await expect(
      service.create('u1', { ...base, shiftId: 's1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a shift of someone else is not found', async () => {
    const { service } = setup(null);
    await expect(
      service.create('u1', { ...base, shiftId: 's1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects backwards and overly long ranges', async () => {
    const { service } = setup();
    await expect(
      service.create('u1', {
        ...base,
        startsOn: '2026-11-08',
        endsOn: '2026-11-02',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('u1', {
        ...base,
        startsOn: '2026-01-01',
        endsOn: '2027-06-01',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editing scopes by owner and never changes the owner', async () => {
    const { service, prisma } = setup();
    await service.update('u1', 'e1', base);
    const [args] = prisma.scheduleException.updateMany.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(args.where).toEqual({ id: 'e1', userId: 'u1' });
    expect(args.data).not.toHaveProperty('userId');
  });

  it('editing a change of someone else is not found', async () => {
    const { service, prisma } = setup();
    prisma.scheduleException.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update('u1', 'e1', base)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('editing refuses a shift of someone else', async () => {
    const { service, prisma } = setup(null);
    await expect(
      service.update('u1', 'e1', { ...base, shiftId: 's1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.scheduleException.updateMany).not.toHaveBeenCalled();
  });

  it('removing scopes by owner', async () => {
    const { service, prisma } = setup();
    prisma.scheduleException.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('u1', 'e1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.scheduleException.deleteMany).toHaveBeenCalledWith({
      where: { id: 'e1', userId: 'u1' },
    });
  });
});
