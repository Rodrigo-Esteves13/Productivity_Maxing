import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { FlashcardsService } from './flashcards.service';
import {
  FLASHCARD_FORECAST_DAYS,
  MAX_FLASHCARDS_PER_USER,
} from './flashcards.constants';

function setup(existing = 0) {
  const prisma = {
    flashcard: {
      count: jest.fn().mockResolvedValue(existing),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'c1' }),
      createMany: jest.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
      ),
    },
    task: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new FlashcardsService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('FlashcardsService.createMany', () => {
  it('creates every card for the user and reports the count', async () => {
    const { service, prisma } = setup();
    const result = await service.createMany('u1', {
      cards: [
        { front: 'a', back: 'b' },
        { front: 'c', back: 'd', areaId: null },
      ],
    });
    expect(result).toEqual({ created: 2 });
    expect(prisma.flashcard.createMany).toHaveBeenCalledWith({
      data: [
        { userId: 'u1', front: 'a', back: 'b', areaId: null },
        { userId: 'u1', front: 'c', back: 'd', areaId: null },
      ],
    });
  });

  it('refuses an import that would pass the per-user limit', async () => {
    const { service, prisma } = setup(MAX_FLASHCARDS_PER_USER - 1);
    await expect(
      service.createMany('u1', {
        cards: [
          { front: 'a', back: 'b' },
          { front: 'c', back: 'd' },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.flashcard.createMany).not.toHaveBeenCalled();
  });
});

describe('FlashcardsService.restore', () => {
  const dto = {
    dueAt: '2026-01-01T00:00:00.000Z',
    intervalDays: 3,
    ease: 2.5,
    reps: 2,
    lapses: 0,
  };

  it('scopes the update and the read by userId', async () => {
    const { service, prisma } = setup();
    await service.restore('u1', 'c1', dto);
    expect(prisma.flashcard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', userId: 'u1' } }),
    );
    expect(prisma.flashcard.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1', userId: 'u1' } }),
    );
  });

  it('refuses a card that belongs to someone else', async () => {
    const { service, prisma } = setup();
    prisma.flashcard.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.restore('u2', 'c1', dto)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('FlashcardsService.forecast', () => {
  it('scopes both queries by userId', async () => {
    const { service, prisma } = setup();
    const result = await service.forecast('u1');
    expect(result.days).toHaveLength(FLASHCARD_FORECAST_DAYS);
    const scopedToUser = expect.objectContaining({
      where: expect.objectContaining({ userId: 'u1' }) as unknown,
    }) as unknown;
    expect(prisma.flashcard.findMany).toHaveBeenCalledWith(scopedToUser);
    expect(prisma.task.findMany).toHaveBeenCalledWith(scopedToUser);
  });
});
