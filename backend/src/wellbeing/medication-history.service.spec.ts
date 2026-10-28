import { BadRequestException } from '@nestjs/common';
import { MedicationSchedule } from '@prisma/client';
import {
  MedicationHistoryService,
  scheduledSlotsOn,
} from './medication-history.service';
import type { PrismaService } from '../prisma/prisma.service';

const daily = {
  id: 'm1',
  createdAt: new Date('2026-10-10T12:00:00Z'),
  updatedAt: new Date('2026-10-20T12:00:00Z'),
  active: true,
  schedule: MedicationSchedule.DAILY,
  times: [480, 1200],
};

describe('scheduledSlotsOn', () => {
  it('counts every daily time from the creation day on', () => {
    expect(scheduledSlotsOn(daily, '2026-10-09')).toBe(0);
    expect(scheduledSlotsOn(daily, '2026-10-10')).toBe(2);
  });

  it('stops counting after a medication was deactivated', () => {
    const stopped = { ...daily, active: false };
    expect(scheduledSlotsOn(stopped, '2026-10-20')).toBe(2);
    expect(scheduledSlotsOn(stopped, '2026-10-21')).toBe(0);
  });

  it('never counts "as needed" medications as planned', () => {
    const asNeeded = { ...daily, schedule: MedicationSchedule.AS_NEEDED };
    expect(scheduledSlotsOn(asNeeded, '2026-10-15')).toBe(0);
  });
});

describe('MedicationHistoryService', () => {
  function setup() {
    const prisma = {
      medication: {
        findMany: jest.fn().mockResolvedValue([{ ...daily, name: 'A' }]),
      },
      medicationDose: {
        findMany: jest.fn().mockResolvedValue([
          { medicationId: 'm1', date: new Date('2026-10-11T00:00:00Z') },
        ]),
      },
      medicationIntake: { groupBy: jest.fn().mockResolvedValue([]) },
    };
    const service = new MedicationHistoryService(
      prisma as unknown as PrismaService,
    );
    return { service, prisma };
  }

  it('rejects ranges that are too long or reversed', async () => {
    const { service } = setup();
    await expect(
      service.get('me', '2026-01-01', '2026-12-31'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.get('me', '2026-10-12', '2026-10-10'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('adds up planned and taken doses for the owner only', async () => {
    const { service, prisma } = setup();
    const result = await service.get('me', '2026-10-10', '2026-10-11');
    expect(prisma.medication.findMany.mock.calls[0][0].where).toEqual({
      userId: 'me',
    });
    expect(result.days).toEqual([
      { date: '2026-10-10', scheduled: 2, taken: 0 },
      { date: '2026-10-11', scheduled: 2, taken: 1 },
    ]);
    expect(result.totals).toEqual({ scheduled: 4, taken: 1, asNeeded: 0 });
  });

  it('never counts more taken than planned on a day (old time slot left marked)', async () => {
    const { service, prisma } = setup();
    const day = new Date('2026-10-11T00:00:00Z');
    prisma.medicationDose.findMany.mockResolvedValue([
      { medicationId: 'm1', date: day },
      { medicationId: 'm1', date: day },
      { medicationId: 'm1', date: day },
    ]);
    const result = await service.get('me', '2026-10-10', '2026-10-11');
    expect(result.days[1]).toEqual({ date: '2026-10-11', scheduled: 2, taken: 2 });
    expect(result.medications[0].taken).toBe(2);
  });
});
