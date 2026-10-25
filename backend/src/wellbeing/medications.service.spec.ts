import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MedicationSchedule } from '@prisma/client';
import { findDueDoses, MedicationsService } from './medications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { MedicationDisclaimerService } from './medication-disclaimer.service';

const acceptedDisclaimer = {
  assertAccepted: jest.fn().mockResolvedValue(undefined),
} as unknown as MedicationDisclaimerService;

describe('findDueDoses', () => {
  const med = (times: number[], handled: number[] = []) => ({
    id: 'm1',
    name: 'Vitamin D',
    times,
    doses: handled.map((slotMinutes) => ({ slotMinutes })),
  });

  it('only doses whose time passed within the window', () => {
    const due = findDueDoses([med([480, 540, 1200])], 540);
    expect(due.map((d) => d.slotMinutes)).toEqual([480, 540]);
  });

  it('skips doses already reminded or taken', () => {
    expect(findDueDoses([med([480], [480])], 490)).toEqual([]);
  });

  it('does not remind doses that are hours late', () => {
    expect(findDueDoses([med([480])], 480 + 120)).toEqual([]);
  });
});

describe('MedicationsService ownership', () => {
  const setup = () => {
    const prisma = {
      medication: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      medicationDose: { upsert: jest.fn() },
    };
    const service = new MedicationsService(
      prisma as unknown as PrismaService,
      { notifyUser: jest.fn() } as unknown as PushService,
      acceptedDisclaimer,
    );
    return { service, prisma };
  };

  it("another user's medication is a 404 on update and delete", async () => {
    const { service, prisma } = setup();
    await expect(
      service.update('u1', 'm1', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove('u1', 'm1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.medication.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1', userId: 'u1' } }),
    );
    expect(prisma.medication.updateMany).not.toHaveBeenCalled();
    expect(prisma.medication.deleteMany).toHaveBeenCalledWith({
      where: { id: 'm1', userId: 'u1' },
    });
  });

  it("marking a dose of another user's medication is a 404", async () => {
    const { service, prisma } = setup();
    await expect(
      service.setDose('u1', 'm1', {
        date: '2026-10-21',
        slotMinutes: 480,
        taken: true,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.medicationDose.upsert).not.toHaveBeenCalled();
  });
});

describe('MedicationsService schedule', () => {
  const setup = () => {
    const prisma = {
      medication: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: unknown }) => data),
      },
    };
    const service = new MedicationsService(
      prisma as unknown as PrismaService,
      { notifyUser: jest.fn() } as unknown as PushService,
      acceptedDisclaimer,
    );
    return { service, prisma };
  };

  it('"as needed" drops times and reminders', async () => {
    const { service } = setup();
    const created = await service.create('u1', {
      name: 'Ibuprofen',
      schedule: MedicationSchedule.AS_NEEDED,
      times: [480],
    });
    expect(created).toMatchObject({ times: [], remindersEnabled: false });
  });

  it('daily medication needs at least one time', async () => {
    const { service } = setup();
    await expect(
      service.create('u1', { name: 'Vitamin D', times: [] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('nothing is created before the notice is accepted', async () => {
    const prisma = { medication: { count: jest.fn(), create: jest.fn() } };
    const service = new MedicationsService(
      prisma as unknown as PrismaService,
      { notifyUser: jest.fn() } as unknown as PushService,
      {
        assertAccepted: jest.fn().mockRejectedValue(new ForbiddenException()),
      } as unknown as MedicationDisclaimerService,
    );
    await expect(
      service.create('u1', { name: 'Vitamin D', times: [480] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.medication.create).not.toHaveBeenCalled();
  });
});
