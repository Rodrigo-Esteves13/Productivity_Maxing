import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { FlashcardsService } from './flashcards.service';
import { MAX_FLASHCARDS_PER_USER } from './flashcards.constants';

function setup(existing = 0) {
  const prisma = {
    flashcard: {
      count: jest.fn().mockResolvedValue(existing),
      createMany: jest.fn(({ data }: { data: unknown[] }) =>
        Promise.resolve({ count: data.length }),
      ),
    },
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
