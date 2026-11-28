import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MedicationSchedule } from '@prisma/client';
import { MedicationIntakesService } from './medication-intakes.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { MedicationDisclaimerService } from './medication-disclaimer.service';

describe('MedicationIntakesService', () => {
  const setup = (
    medication: { schedule: MedicationSchedule } | null,
    accepted = true,
  ) => {
    const prisma = {
      medication: {
        findFirst: jest.fn().mockResolvedValue(medication),
        findMany: jest.fn().mockResolvedValue([]),
      },
      medicationIntake: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'i1',
          medicationId: 'm1',
          takenAt: new Date(),
          dose: null,
          note: null,
          medication: { name: 'Ibuprofen' },
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({
          id: 'i1',
          medicationId: 'm1',
          takenAt: new Date(),
          dose: null,
          note: null,
          medication: { name: 'Ibuprofen' },
        }),
      },
    };
    const tx = { ...prisma, $executeRaw: jest.fn().mockResolvedValue(0) };
    const prismaWithTx = {
      ...prisma,
      $transaction: jest.fn(<T>(run: (client: typeof tx) => Promise<T>) =>
        run(tx),
      ),
    };
    const disclaimer = {
      assertAccepted: accepted
        ? jest.fn().mockResolvedValue(undefined)
        : jest.fn().mockRejectedValue(new ForbiddenException()),
    };
    const service = new MedicationIntakesService(
      prismaWithTx as unknown as PrismaService,
      disclaimer as unknown as MedicationDisclaimerService,
    );
    return { service, prisma };
  };
  const now = () => new Date().toISOString();

  it('nothing is logged before the notice is accepted', async () => {
    const { service, prisma } = setup(
      { schedule: MedicationSchedule.AS_NEEDED },
      false,
    );
    await expect(
      service.create('u1', { medicationId: 'm1', takenAt: now() }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.medicationIntake.create).not.toHaveBeenCalled();
  });

  it("logging an intake of another user's medication is a 404", async () => {
    const { service, prisma } = setup(null);
    await expect(
      service.create('u1', { medicationId: 'm1', takenAt: now() }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1', userId: 'u1' } }),
    );
    expect(prisma.medicationIntake.create).not.toHaveBeenCalled();
  });

  it("deleting another user's entry is a 404", async () => {
    const { service, prisma } = setup(null);
    await expect(service.remove('u1', 'i1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.medicationIntake.deleteMany).toHaveBeenCalledWith({
      where: { id: 'i1', userId: 'u1' },
    });
  });

  it("editing another user's entry is a 404 and writes nothing", async () => {
    const { service, prisma } = setup(null);
    prisma.medicationIntake.findFirst.mockResolvedValue(null);
    await expect(
      service.update('u1', 'i1', { dose: '2' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medicationIntake.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'i1', userId: 'u1' } }),
    );
    expect(prisma.medicationIntake.update).not.toHaveBeenCalled();
  });

  it('editing is blocked before the notice is accepted', async () => {
    const { service, prisma } = setup(null, false);
    await expect(
      service.update('u1', 'i1', { dose: '2' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.medicationIntake.update).not.toHaveBeenCalled();
  });

  it('edits dose and note of an owned entry, blank clears', async () => {
    const { service, prisma } = setup(null);
    prisma.medicationIntake.findFirst.mockResolvedValue({ id: 'i1' });
    await service.update('u1', 'i1', { dose: ' 2 tabs ', note: '  ' });
    const [[args]] = prisma.medicationIntake.update.mock.calls as [
      [{ where: Record<string, unknown>; data: Record<string, unknown> }],
    ];
    expect(args.data).toEqual({ dose: '2 tabs', note: null });
    // A escrita tambem leva o userId, nao so a leitura de posse.
    expect(args.where).toEqual({ id: 'i1', userId: 'u1' });
  });

  it('moving an entry to a full day is rejected, excluding itself from the count', async () => {
    const { service, prisma } = setup(null);
    prisma.medicationIntake.findFirst.mockResolvedValue({ id: 'i1' });
    prisma.medicationIntake.count.mockResolvedValue(30);
    await expect(
      service.update('u1', 'i1', { takenAt: now() }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.medicationIntake.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          id: { not: 'i1' },
        }) as unknown,
      }),
    );
    expect(prisma.medicationIntake.update).not.toHaveBeenCalled();
  });

  it('rejects an edited time in the future', async () => {
    const { service } = setup(null);
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await expect(
      service.update('u1', 'i1', { takenAt: future }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs an extra dose of a scheduled medication, twice at the same time', async () => {
    const { service, prisma } = setup({ schedule: MedicationSchedule.DAILY });
    const takenAt = now();
    await service.create('u1', { medicationId: 'm1', takenAt });
    await service.create('u1', { medicationId: 'm1', takenAt });
    expect(prisma.medicationIntake.create).toHaveBeenCalledTimes(2);
  });

  it('rejects the entry when the day is already full, under the lock', async () => {
    const { service, prisma } = setup({
      schedule: MedicationSchedule.AS_NEEDED,
    });
    prisma.medicationIntake.count.mockResolvedValue(30);
    await expect(
      service.create('u1', { medicationId: 'm1', takenAt: now() }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.medicationIntake.create).not.toHaveBeenCalled();
  });

  it('rejects times in the future or too far back', async () => {
    const { service } = setup({ schedule: MedicationSchedule.AS_NEEDED });
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await expect(
      service.create('u1', { medicationId: 'm1', takenAt: future }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('u1', {
        medicationId: 'm1',
        takenAt: '2020-01-01T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs an owned "as needed" intake under the user', async () => {
    const { service, prisma } = setup({
      schedule: MedicationSchedule.AS_NEEDED,
    });
    await service.create('u1', { medicationId: 'm1', takenAt: now() });
    const [[args]] = prisma.medicationIntake.create.mock.calls as [
      [{ data: { userId: string; medicationId: string } }],
    ];
    expect(args.data).toMatchObject({ userId: 'u1', medicationId: 'm1' });
  });

  it('rejects ranges that are too long or reversed', async () => {
    const { service } = setup(null);
    await expect(
      service.list('u1', { from: '2026-10-24', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.list('u1', { from: '2025-01-01', to: '2026-10-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
