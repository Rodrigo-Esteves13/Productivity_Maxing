import { BadRequestException } from '@nestjs/common';
import { MoodService } from './mood.service';
import { MAX_MOOD_PAST_DAYS } from './wellbeing.constants';
import type { PrismaService } from '../prisma/prisma.service';

interface UpsertArgs {
  where: { userId_date: { userId: string } };
}

describe('MoodService.upsert', () => {
  const setup = () => {
    const upsert = jest.fn<Promise<unknown>, [UpsertArgs]>().mockResolvedValue({
      id: 'm1',
      date: new Date('2026-01-01T00:00:00.000Z'),
      mood: 1,
      energy: 1,
      stress: 5,
      note: null,
    });
    const service = new MoodService({
      moodLog: { upsert },
    } as unknown as PrismaService);
    return { service, upsert };
  };

  afterEach(() => {
    jest.useRealTimers();
  });

  it('saves a past day under the user', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-05T12:00:00Z'));
    const { service, upsert } = setup();
    await service.upsert('u1', '2026-01-01', { mood: 1, energy: 1, stress: 5 });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [arg] = upsert.mock.calls[0];
    expect(arg.where.userId_date.userId).toBe('u1');
  });

  it('rejects a day in the future', async () => {
    const { service, upsert } = setup();
    await expect(
      service.upsert('u1', '2999-01-01', { mood: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('uses the Lisbon day: summer 00:30 Lisbon is still the previous UTC day', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T23:30:00Z'));
    const { service, upsert } = setup();
    await service.upsert('u1', '2026-06-02', { mood: 3 });
    expect(upsert).toHaveBeenCalledTimes(1);
    await expect(
      service.upsert('u1', '2026-06-03', { mood: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a day older than the past limit', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-30T12:00:00Z'));
    const { service, upsert } = setup();
    await expect(
      service.upsert('u1', '2026-01-01', { mood: 3 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsert).not.toHaveBeenCalled();
    expect(MAX_MOOD_PAST_DAYS).toBe(90);
  });
});
