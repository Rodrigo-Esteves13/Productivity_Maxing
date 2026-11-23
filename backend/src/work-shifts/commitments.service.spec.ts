import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CommitmentsService } from './commitments.service';
import { MAX_COMMITMENTS_PER_USER } from './work-shifts.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { DistanceMatrixService } from '../maps/distance-matrix.service';
import type {
  CreateCommitmentDto,
  UpdateCommitmentDto,
} from './dto/commitment.dto';

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError('dup', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function setup(count = 0) {
  const commitment = {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn().mockResolvedValue({ id: 'c1', name: 'Job' }),
    count: jest.fn().mockResolvedValue(count),
    create: jest.fn().mockResolvedValue({ id: 'c1', name: 'Job' }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  };
  const workShift = { findMany: jest.fn().mockResolvedValue([]) };
  const service = new CommitmentsService(
    { commitment, workShift } as unknown as PrismaService,
    {} as DistanceMatrixService,
  );
  return { service, commitment, workShift };
}

const createDto = (extra: Partial<CreateCommitmentDto> = {}) => ({
  name: 'Job',
  commuteMinutes: 20,
  ...extra,
});
const updateDto = (extra: Partial<UpdateCommitmentDto>) =>
  extra as UpdateCommitmentDto;

describe('CommitmentsService.overview', () => {
  it('scopes commitments and loose shifts to the user', async () => {
    const { service, commitment, workShift } = setup();
    await service.overview('u1');
    const [cArg] = commitment.findMany.mock.calls[0] as [
      { where: { userId: string } },
    ];
    expect(cArg.where).toEqual({ userId: 'u1' });
    const [sArg] = workShift.findMany.mock.calls[0] as [
      { where: Record<string, unknown> },
    ];
    expect(sArg.where).toEqual({ userId: 'u1', commitmentId: null });
  });

  it('sorts daysOff ascending and maps shifts', async () => {
    const { service, commitment } = setup();
    commitment.findMany.mockResolvedValue([
      {
        id: 'c1',
        name: 'Job',
        commuteMinutes: 20,
        address: null,
        commuteMode: 'DRIVING',
        daysOff: [6, 0, 3],
        contractType: null,
        endsOn: null,
        worksOnHolidays: true,
        shifts: [],
      },
    ]);
    const result = await service.overview('u1');
    expect(result.commitments[0].daysOff).toEqual([0, 3, 6]);
    expect(result.commitments[0].shifts).toEqual([]);
    expect(result.ungroupedShifts).toEqual([]);
  });
});

describe('CommitmentsService.create', () => {
  it('rejects at the per-user cap and counts only the user rows', async () => {
    const { service, commitment } = setup(MAX_COMMITMENTS_PER_USER);
    await expect(service.create('u1', createDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(commitment.count).toHaveBeenCalledWith({ where: { userId: 'u1' } });
    expect(commitment.create).not.toHaveBeenCalled();
  });

  it('stores under the caller with defaults for optional fields', async () => {
    const { service, commitment } = setup();
    await service.create('u1', createDto({ address: '' }));
    const [arg] = commitment.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data).toMatchObject({
      userId: 'u1',
      name: 'Job',
      commuteMinutes: 20,
      address: null,
      daysOff: [],
      contractType: null,
      endsOn: null,
    });
    expect(arg.data).not.toHaveProperty('commuteMode');
    expect(arg.data).not.toHaveProperty('worksOnHolidays');
  });

  it('parses endsOn and forwards explicit flags', async () => {
    const { service, commitment } = setup();
    await service.create(
      'u1',
      createDto({ endsOn: '2026-12-31', worksOnHolidays: false }),
    );
    const [arg] = commitment.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data.endsOn).toEqual(new Date('2026-12-31T00:00:00.000Z'));
    expect(arg.data.worksOnHolidays).toBe(false);
  });

  it('maps a unique violation to Conflict', async () => {
    const { service, commitment } = setup();
    commitment.create.mockRejectedValue(uniqueError());
    await expect(service.create('u1', createDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows unknown errors untouched', async () => {
    const { service, commitment } = setup();
    commitment.create.mockRejectedValue(new Error('boom'));
    await expect(service.create('u1', createDto())).rejects.toThrow('boom');
  });
});

describe('CommitmentsService.update', () => {
  it('updates only rows of the caller and re-reads scoped to the caller', async () => {
    const { service, commitment } = setup();
    await service.update('u1', 'c1', updateDto({ name: 'New' }));
    const [upd] = commitment.updateMany.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(upd.where).toEqual({ id: 'c1', userId: 'u1' });
    expect(upd.data).toEqual({ name: 'New' });
    const [read] = commitment.findFirst.mock.calls[0] as [{ where: unknown }];
    expect(read.where).toEqual({ id: 'c1', userId: 'u1' });
  });

  it('foreign or missing id: NotFound and no re-read', async () => {
    const { service, commitment } = setup();
    commitment.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('u1', 'other', updateDto({ name: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(commitment.findFirst).not.toHaveBeenCalled();
  });

  it('endsOn null clears the date, a key parses it, blank address nulls', async () => {
    const { service, commitment } = setup();
    await service.update('u1', 'c1', updateDto({ endsOn: null, address: '' }));
    const [a] = commitment.updateMany.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(a.data).toEqual({ endsOn: null, address: null });

    await service.update('u1', 'c1', updateDto({ endsOn: '2027-01-02' }));
    const [b] = commitment.updateMany.mock.calls[1] as [
      { data: Record<string, unknown> },
    ];
    expect(b.data.endsOn).toEqual(new Date('2027-01-02T00:00:00.000Z'));
  });

  it('maps a unique violation to Conflict', async () => {
    const { service, commitment } = setup();
    commitment.updateMany.mockRejectedValue(uniqueError());
    await expect(
      service.update('u1', 'c1', updateDto({ name: 'dup' })),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('row vanishing between write and read: NotFound', async () => {
    const { service, commitment } = setup();
    commitment.findFirst.mockResolvedValue(null);
    await expect(
      service.update('u1', 'c1', updateDto({ name: 'x' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('CommitmentsService.remove', () => {
  it('deletes scoped to the caller', async () => {
    const { service, commitment } = setup();
    await service.remove('u1', 'c1');
    expect(commitment.deleteMany).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'u1' },
    });
  });

  it('foreign or missing id: NotFound', async () => {
    const { service, commitment } = setup();
    commitment.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('u1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
