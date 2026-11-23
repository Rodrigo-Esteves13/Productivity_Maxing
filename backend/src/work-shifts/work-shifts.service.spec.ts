import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  WorkShiftsService,
  toShiftView,
  SHIFT_SELECT,
} from './work-shifts.service';
import { MAX_RANGE_DAYS, MAX_SHIFTS_PER_USER } from './work-shifts.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateWorkShiftDto } from './dto/create-work-shifts.dto';
import type { UpdateWorkShiftDto } from './dto/update-work-shift.dto';

type ShiftRowLike = Parameters<typeof toShiftView>[0];

function row(extra: Partial<ShiftRowLike> = {}): ShiftRowLike {
  return {
    id: 's1',
    dayOfWeek: 1,
    date: null,
    startsOn: null,
    startMinutes: 540,
    endMinutes: 600,
    bufferMinutes: 10,
    label: 'Shift',
    address: 'Rua A',
    commuteMode: null,
    commitmentId: null,
    commitment: null,
    ...extra,
  };
}

function setup(existing = 0) {
  const workShift = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(existing),
    create: jest.fn((arg: unknown) => ({ __create: arg })),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const commitment = { findMany: jest.fn().mockResolvedValue([]) };
  const scheduleException = { findMany: jest.fn().mockResolvedValue([]) };
  const prisma = {
    workShift,
    commitment,
    scheduleException,
    $transaction: jest.fn((ops: unknown[]) => Promise.resolve(ops)),
  };
  const service = new WorkShiftsService(prisma as unknown as PrismaService);
  return { service, prisma, workShift, commitment, scheduleException };
}

const weekly = (extra: Partial<CreateWorkShiftDto> = {}) =>
  ({
    dayOfWeek: 1,
    startMinutes: 540,
    endMinutes: 600,
    ...extra,
  }) as CreateWorkShiftDto;
const batch = (...shifts: CreateWorkShiftDto[]) => ({ shifts });
const upd = (extra: Partial<UpdateWorkShiftDto>) => extra as UpdateWorkShiftDto;

describe('toShiftView', () => {
  it('prefers commitment data over the shift own fields', () => {
    const view = toShiftView(
      row({
        commitment: {
          name: 'Cafe',
          commuteMinutes: 25,
          daysOff: [],
          endsOn: null,
          address: 'Rua B',
          commuteMode: 'WALKING',
          worksOnHolidays: true,
        },
      }),
    );
    expect(view).toMatchObject({
      label: 'Cafe',
      bufferMinutes: 25,
      address: 'Rua B',
      commuteMode: 'WALKING',
    });
  });

  it('loose shift keeps its own fields', () => {
    expect(toShiftView(row())).toMatchObject({
      label: 'Shift',
      bufferMinutes: 10,
      address: 'Rua A',
    });
  });
});

describe('WorkShiftsService.list', () => {
  it('is scoped to the user', async () => {
    const { service, workShift } = setup();
    workShift.findMany.mockResolvedValue([row()]);
    const result = await service.list('u1');
    expect(result).toHaveLength(1);
    expect(workShift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        select: SHIFT_SELECT,
      }),
    );
  });
});

describe('WorkShiftsService.createMany', () => {
  it('rejects a shift with both dayOfWeek and date', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createMany('u1', batch(weekly({ date: '2026-06-10' }))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a shift with neither dayOfWeek nor date', async () => {
    const { service } = setup();
    await expect(
      service.createMany('u1', batch(weekly({ dayOfWeek: undefined }))),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects start >= end', async () => {
    const { service } = setup();
    await expect(
      service.createMany(
        'u1',
        batch(weekly({ startMinutes: 600, endMinutes: 600 })),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('commitment of another user: NotFound, nothing created', async () => {
    const { service, commitment, prisma } = setup();
    commitment.findMany.mockResolvedValue([]);
    await expect(
      service.createMany('u1', batch(weekly({ commitmentId: 'foreign' }))),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commitment.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', id: { in: ['foreign'] } },
      select: { id: true, daysOff: true },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('dedupes commitment ids when checking ownership', async () => {
    const { service, commitment } = setup();
    commitment.findMany.mockResolvedValue([{ id: 'c1', daysOff: [] }]);
    await service.createMany(
      'u1',
      batch(
        weekly({ commitmentId: 'c1' }),
        weekly({ commitmentId: 'c1', dayOfWeek: 2 }),
      ),
    );
    const [arg] = commitment.findMany.mock.calls[0] as [
      { where: { id: { in: string[] } } },
    ];
    expect(arg.where.id.in).toEqual(['c1']);
  });

  it('skips weekly shifts on a fixed day off; all skipped returns [] without a write', async () => {
    const { service, commitment, workShift, prisma } = setup();
    commitment.findMany.mockResolvedValue([{ id: 'c1', daysOff: [1] }]);
    const result = await service.createMany(
      'u1',
      batch(weekly({ commitmentId: 'c1', dayOfWeek: 1 })),
    );
    expect(result).toEqual([]);
    expect(workShift.count).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('one-off shifts on a day off are kept (deliberate swap)', async () => {
    const { service, commitment, prisma } = setup();
    commitment.findMany.mockResolvedValue([{ id: 'c1', daysOff: [3] }]);
    await service.createMany(
      'u1',
      batch({
        commitmentId: 'c1',
        date: '2026-06-10',
        startMinutes: 540,
        endMinutes: 600,
      }),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('enforces the per-user cap (count scoped to user), nothing written', async () => {
    const { service, workShift, prisma } = setup(MAX_SHIFTS_PER_USER);
    await expect(
      service.createMany('u1', batch(weekly())),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workShift.count).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates everything in one transaction under the caller, trimming text', async () => {
    const { service, workShift, prisma } = setup();
    await service.createMany(
      'u1',
      batch(
        weekly({ label: '  Gym ', address: '   ', startsOn: '2026-07-01' }),
        {
          date: '2026-06-10',
          startsOn: '2026-07-01',
          startMinutes: 60,
          endMinutes: 120,
        },
      ),
    );
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const creates = workShift.create.mock.calls as [
      { data: Record<string, unknown> },
    ][];
    expect(creates).toHaveLength(2);
    for (const [arg] of creates) expect(arg.data.userId).toBe('u1');
    expect(creates[0][0].data).toMatchObject({
      label: 'Gym',
      address: null,
      dayOfWeek: 1,
      date: null,
      startsOn: new Date('2026-07-01T00:00:00.000Z'),
      bufferMinutes: 0,
    });
    // Pontual nunca guarda startsOn.
    expect(creates[1][0].data).toMatchObject({
      dayOfWeek: null,
      startsOn: null,
      date: new Date('2026-06-10T00:00:00.000Z'),
    });
  });
});

describe('WorkShiftsService.update', () => {
  const current = {
    startMinutes: 540,
    endMinutes: 600,
    dayOfWeek: 2,
    commitment: null as { daysOff: number[] } | null,
  };

  it('rejects dayOfWeek and date together before any query', async () => {
    const { service, workShift } = setup();
    await expect(
      service.update('u1', 's1', upd({ dayOfWeek: 1, date: '2026-06-10' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workShift.findFirst).not.toHaveBeenCalled();
  });

  it('foreign or missing shift: NotFound, no write', async () => {
    const { service, workShift } = setup();
    await expect(
      service.update('u1', 'other', upd({ label: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(workShift.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'other', userId: 'u1' } }),
    );
    expect(workShift.updateMany).not.toHaveBeenCalled();
  });

  it('validates the merged result: only endMinutes before current start', async () => {
    const { service, workShift } = setup();
    workShift.findFirst.mockResolvedValue(current);
    await expect(
      service.update('u1', 's1', upd({ endMinutes: 500 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workShift.updateMany).not.toHaveBeenCalled();
  });

  it('moving to a commitment of another user: NotFound', async () => {
    const { service, workShift, commitment } = setup();
    workShift.findFirst.mockResolvedValue(current);
    commitment.findMany.mockResolvedValue([]);
    await expect(
      service.update('u1', 's1', upd({ commitmentId: 'foreign' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(workShift.updateMany).not.toHaveBeenCalled();
  });

  it('rejects landing on a fixed day off of the current commitment', async () => {
    const { service, workShift } = setup();
    workShift.findFirst.mockResolvedValue({
      ...current,
      commitment: { daysOff: [4] },
    });
    await expect(
      service.update('u1', 's1', upd({ dayOfWeek: 4 })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('switching to a one-off date skips the day off check', async () => {
    const { service, workShift } = setup();
    workShift.findFirst
      .mockResolvedValueOnce({ ...current, commitment: { daysOff: [2] } })
      .mockResolvedValueOnce(row({ date: new Date('2026-06-10') }));
    await expect(
      service.update('u1', 's1', upd({ date: '2026-06-10' })),
    ).resolves.toBeDefined();
    const [arg] = workShift.updateMany.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(arg.where).toEqual({ id: 's1', userId: 'u1' });
    expect(arg.data).toMatchObject({ dayOfWeek: null, startsOn: null });
  });

  it('unlinking the commitment (null) drops the day off rule', async () => {
    const { service, workShift } = setup();
    workShift.findFirst
      .mockResolvedValueOnce({ ...current, commitment: { daysOff: [2] } })
      .mockResolvedValueOnce(row());
    await expect(
      service.update('u1', 's1', upd({ commitmentId: null })),
    ).resolves.toBeDefined();
  });

  it('trims label and address, blanks become null', async () => {
    const { service, workShift } = setup();
    workShift.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(row());
    await service.update('u1', 's1', upd({ label: '   ', address: ' Rua ' }));
    const [arg] = workShift.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data).toMatchObject({ label: null, address: 'Rua' });
  });

  it('write matching 0 rows: NotFound (deleted in between)', async () => {
    const { service, workShift } = setup();
    workShift.findFirst.mockResolvedValue(current);
    workShift.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('u1', 's1', upd({ label: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('re-read returning null: NotFound; re-read is scoped to the user', async () => {
    const { service, workShift } = setup();
    workShift.findFirst
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(null);
    await expect(
      service.update('u1', 's1', upd({ label: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect((workShift.findFirst.mock.calls as unknown[][])[1][0]).toMatchObject(
      {
        where: { id: 's1', userId: 'u1' },
      },
    );
  });
});

describe('WorkShiftsService.remove', () => {
  it('deletes scoped to the caller', async () => {
    const { service, workShift } = setup();
    await service.remove('u1', 's1');
    expect(workShift.deleteMany).toHaveBeenCalledWith({
      where: { id: 's1', userId: 'u1' },
    });
  });

  it('foreign or missing: NotFound', async () => {
    const { service, workShift } = setup();
    workShift.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('u1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('WorkShiftsService.expandRange', () => {
  // 2026-06-01 e segunda (weekday 1).
  it('rejects an inverted range', async () => {
    const { service, workShift } = setup();
    await expect(
      service.expandRange('u1', '2026-06-10', '2026-06-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(workShift.findMany).not.toHaveBeenCalled();
  });

  it('rejects a range over the maximum, accepts exactly the maximum', async () => {
    const { service } = setup();
    await expect(
      service.expandRange('u1', '2026-01-01', '2026-12-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
    // 2026-01-01 + 61 dias = 62 dias inclusive.
    await expect(
      service.expandRange('u1', '2026-01-01', '2026-03-03'),
    ).resolves.toEqual([]);
    expect(MAX_RANGE_DAYS).toBe(62);
  });

  it('scopes shifts and exceptions to the user', async () => {
    const { service, workShift, scheduleException } = setup();
    await service.expandRange('u1', '2026-06-01', '2026-06-07');
    const [s] = workShift.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(s.where.userId).toBe('u1');
    const [e] = scheduleException.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(e.where.userId).toBe('u1');
  });

  it('expands a weekly shift once per matching weekday, sorted by date', async () => {
    const { service, workShift } = setup();
    workShift.findMany.mockResolvedValue([row({ dayOfWeek: 1 })]);
    const result = await service.expandRange('u1', '2026-06-01', '2026-06-15');
    expect(result.map((o) => o.date)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
    ]);
    expect(result[0]).toMatchObject({
      shiftId: 's1',
      isRecurring: true,
      skipped: null,
    });
  });

  it('respects startsOn, commitment endsOn and fixed days off', async () => {
    const { service, workShift } = setup();
    workShift.findMany.mockResolvedValue([
      row({
        dayOfWeek: 1,
        startsOn: new Date('2026-06-05T00:00:00Z'),
        commitment: {
          name: 'Job',
          commuteMinutes: 0,
          daysOff: [],
          endsOn: new Date('2026-06-10T00:00:00Z'),
          address: null,
          commuteMode: 'WALKING',
          worksOnHolidays: true,
        },
      }),
    ]);
    const result = await service.expandRange('u1', '2026-06-01', '2026-06-22');
    // 06-01 antes de startsOn, 06-15 e 06-22 depois do fim do contrato.
    expect(result.map((o) => o.date)).toEqual(['2026-06-08']);

    workShift.findMany.mockResolvedValue([
      row({
        dayOfWeek: 1,
        commitment: {
          name: 'Job',
          commuteMinutes: 0,
          daysOff: [1],
          endsOn: null,
          address: null,
          commuteMode: 'WALKING',
          worksOnHolidays: true,
        },
      }),
    ]);
    await expect(
      service.expandRange('u1', '2026-06-01', '2026-06-22'),
    ).resolves.toEqual([]);
  });

  it('includes a one-off shift only on its date and flags it non recurring', async () => {
    const { service, workShift } = setup();
    workShift.findMany.mockResolvedValue([
      row({
        id: 'o1',
        dayOfWeek: null,
        date: new Date('2026-06-03T00:00:00Z'),
      }),
    ]);
    const result = await service.expandRange('u1', '2026-06-01', '2026-06-07');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      shiftId: 'o1',
      date: '2026-06-03',
      isRecurring: false,
      exceptionId: null,
      retimed: false,
    });
  });

  it('sorts same-day occurrences by start time', async () => {
    const { service, workShift } = setup();
    workShift.findMany.mockResolvedValue([
      row({ id: 'late', dayOfWeek: 1, startMinutes: 900, endMinutes: 960 }),
      row({ id: 'early', dayOfWeek: 1, startMinutes: 300, endMinutes: 360 }),
    ]);
    const result = await service.expandRange('u1', '2026-06-01', '2026-06-01');
    expect(result.map((o) => o.shiftId)).toEqual(['early', 'late']);
  });
});
