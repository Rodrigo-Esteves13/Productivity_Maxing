import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BloodDonationsService } from './blood-donations.service';
import { MAX_BLOOD_DONATIONS_PER_USER } from './wellbeing.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { CreateBloodDonationDto } from './dto/blood-donation.dto';

function setup(count = 0) {
  const bloodDonation = {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(count),
    create: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirstOrThrow: jest.fn(),
  };
  const service = new BloodDonationsService({
    bloodDonation,
  } as unknown as PrismaService);
  return { service, bloodDonation };
}

const dtoFor = (date: string) =>
  ({ date, type: 'WHOLE_BLOOD' }) as unknown as CreateBloodDonationDto;

const rowOn = (date: string) => ({
  id: 'd1',
  date: new Date(`${date}T00:00:00Z`),
  type: 'WHOLE_BLOOD',
  location: null,
  note: null,
});

describe('BloodDonationsService', () => {
  beforeEach(() =>
    jest.useFakeTimers({
      now: new Date('2026-06-10T12:00:00Z'),
      doNotFake: ['nextTick', 'queueMicrotask'],
    }),
  );
  afterEach(() => jest.useRealTimers());

  it('list is scoped to the user, newest first, capped, dates as keys', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.findMany.mockResolvedValue([rowOn('2026-05-01')]);
    const rows = await service.list('u1');
    expect(bloodDonation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        orderBy: { date: 'desc' },
        take: MAX_BLOOD_DONATIONS_PER_USER,
      }),
    );
    expect(rows[0].date).toBe('2026-05-01');
  });

  it('create stores under the caller and nulls optional fields', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.create.mockResolvedValue(rowOn('2026-06-01'));
    const view = await service.create('u1', dtoFor('2026-06-01'));
    const [arg] = bloodDonation.create.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(arg.data).toMatchObject({
      userId: 'u1',
      location: null,
      note: null,
    });
    expect(view.date).toBe('2026-06-01');
  });

  it('create accepts today', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.create.mockResolvedValue(rowOn('2026-06-10'));
    await expect(
      service.create('u1', dtoFor('2026-06-10')),
    ).resolves.toBeDefined();
  });

  it('create rejects a future date before touching the DB', async () => {
    const { service, bloodDonation } = setup();
    await expect(
      service.create('u1', dtoFor('2026-06-11')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bloodDonation.count).not.toHaveBeenCalled();
    expect(bloodDonation.create).not.toHaveBeenCalled();
  });

  it('create rejects at the per-user cap (count scoped to user)', async () => {
    const { service, bloodDonation } = setup(MAX_BLOOD_DONATIONS_PER_USER);
    await expect(
      service.create('u1', dtoFor('2026-06-01')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bloodDonation.count).toHaveBeenCalledWith({
      where: { userId: 'u1' },
    });
    expect(bloodDonation.create).not.toHaveBeenCalled();
  });

  it('update is scoped to the caller and returns the fresh row', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.updateMany.mockResolvedValue({ count: 1 });
    bloodDonation.findFirstOrThrow.mockResolvedValue(rowOn('2026-06-02'));
    const view = await service.update('u1', 'd1', {
      date: '2026-06-02',
      location: '  ',
    });
    const [arg] = bloodDonation.updateMany.mock.calls[0] as [
      { where: unknown; data: Record<string, unknown> },
    ];
    expect(arg.where).toEqual({ id: 'd1', userId: 'u1' });
    expect(arg.data).toMatchObject({ location: null });
    expect(bloodDonation.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'd1', userId: 'u1' } }),
    );
    expect(view.date).toBe('2026-06-02');
  });

  it('update of a foreign donation: NotFound', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('u1', 'other', { note: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(bloodDonation.findFirstOrThrow).not.toHaveBeenCalled();
  });

  it('update rejects a future date before touching the DB', async () => {
    const { service, bloodDonation } = setup();
    await expect(
      service.update('u1', 'd1', { date: '2026-06-11' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(bloodDonation.updateMany).not.toHaveBeenCalled();
  });

  it('remove deletes only rows of the caller', async () => {
    const { service, bloodDonation } = setup();
    await service.remove('u1', 'd1');
    expect(bloodDonation.deleteMany).toHaveBeenCalledWith({
      where: { id: 'd1', userId: 'u1' },
    });
  });

  it('remove of a missing or foreign donation: NotFound', async () => {
    const { service, bloodDonation } = setup();
    bloodDonation.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('u1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
