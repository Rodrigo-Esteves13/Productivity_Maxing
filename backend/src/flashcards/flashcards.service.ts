import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAreaAccessible } from '../areas/area-access';
import {
  CreateFlashcardDto,
  ListFlashcardsQueryDto,
  UpdateFlashcardDto,
} from './dto/flashcard.dto';
import { scheduleReview, type FlashcardGrade } from './flashcard-schedule';
import {
  FLASHCARD_LIST_LIMIT,
  MAX_FLASHCARDS_PER_USER,
} from './flashcards.constants';

const SELECT = {
  id: true,
  areaId: true,
  front: true,
  back: true,
  dueAt: true,
  intervalDays: true,
  ease: true,
  reps: true,
  lapses: true,
  createdAt: true,
} satisfies Prisma.FlashcardSelect;

@Injectable()
export class FlashcardsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, q: ListFlashcardsQueryDto) {
    return this.prisma.flashcard.findMany({
      where: {
        userId,
        ...(q.areaId ? { areaId: q.areaId } : {}),
        ...(q.dueOnly ? { dueAt: { lte: new Date() } } : {}),
      },
      orderBy: { dueAt: 'asc' },
      take: FLASHCARD_LIST_LIMIT,
      select: SELECT,
    });
  }

  async stats(userId: string) {
    const [total, due] = await Promise.all([
      this.prisma.flashcard.count({ where: { userId } }),
      this.prisma.flashcard.count({
        where: { userId, dueAt: { lte: new Date() } },
      }),
    ]);
    return { total, due };
  }

  async create(userId: string, dto: CreateFlashcardDto) {
    if (dto.areaId) await assertAreaAccessible(this.prisma, userId, dto.areaId);
    const count = await this.prisma.flashcard.count({ where: { userId } });
    if (count >= MAX_FLASHCARDS_PER_USER) {
      throw new BadRequestException(
        `You can keep at most ${MAX_FLASHCARDS_PER_USER} flashcards.`,
      );
    }
    return this.prisma.flashcard.create({
      data: {
        userId,
        front: dto.front,
        back: dto.back,
        areaId: dto.areaId ?? null,
      },
      select: SELECT,
    });
  }

  async update(userId: string, id: string, dto: UpdateFlashcardDto) {
    if (dto.areaId) await assertAreaAccessible(this.prisma, userId, dto.areaId);
    const { count } = await this.prisma.flashcard.updateMany({
      where: { id, userId },
      data: { front: dto.front, back: dto.back, areaId: dto.areaId },
    });
    if (count === 0) throw new NotFoundException('Flashcard not found.');
    return this.prisma.flashcard.findFirstOrThrow({
      where: { id, userId },
      select: SELECT,
    });
  }

  async remove(userId: string, id: string) {
    const { count } = await this.prisma.flashcard.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Flashcard not found.');
  }

  async review(userId: string, id: string, grade: FlashcardGrade) {
    const card = await this.prisma.flashcard.findFirst({
      where: { id, userId },
      select: SELECT,
    });
    if (!card) throw new NotFoundException('Flashcard not found.');
    return this.prisma.flashcard.update({
      where: { id },
      data: scheduleReview(card, grade, new Date()),
      select: SELECT,
    });
  }
}
