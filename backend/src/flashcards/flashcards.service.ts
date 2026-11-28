import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertAreaAccessible } from '../areas/area-access';
import {
  BulkFlashcardsDto,
  CreateFlashcardDto,
  ListFlashcardsQueryDto,
  RestoreFlashcardDto,
  UpdateFlashcardDto,
} from './dto/flashcard.dto';
import { scheduleReview, type FlashcardGrade } from './flashcard-schedule';
import { lisbonDayBounds, toLisbonDateKey } from '../common/date-key.util';
import { bucketForecast, forecastDayKeys } from './flashcard-forecast.util';
import {
  FLASHCARD_FORECAST_DAYS,
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

  async forecast(userId: string) {
    const now = new Date();
    const keys = forecastDayKeys(now, FLASHCARD_FORECAST_DAYS);
    const first = keys[0];
    const last = keys[keys.length - 1];
    const [cards, tasks] = await Promise.all([
      this.prisma.flashcard.findMany({
        where: { userId, dueAt: { lt: lisbonDayBounds(last).end } },
        select: { dueAt: true, areaId: true },
      }),
      this.prisma.task.findMany({
        where: {
          userId,
          progressStatus: { not: 'COMPLETED' },
          academicType: { isEvent: true },
          date: {
            gte: lisbonDayBounds(first).start,
            lt: lisbonDayBounds(last).end,
          },
        },
        orderBy: { date: 'asc' },
        select: { id: true, title: true, date: true, areaId: true },
      }),
    ]);
    return {
      days: bucketForecast(cards, now, FLASHCARD_FORECAST_DAYS),
      exams: tasks.map((t) => ({
        taskId: t.id,
        title: t.title,
        date: toLisbonDateKey(t.date),
        areaId: t.areaId,
      })),
    };
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

  /** Importacao em bloco: tudo ou nada, respeitando o limite por utilizador. */
  async createMany(userId: string, dto: BulkFlashcardsDto) {
    const areaIds = [
      ...new Set(
        dto.cards.map((c) => c.areaId).filter((id): id is string => !!id),
      ),
    ];
    for (const areaId of areaIds) {
      await assertAreaAccessible(this.prisma, userId, areaId);
    }
    const count = await this.prisma.flashcard.count({ where: { userId } });
    if (count + dto.cards.length > MAX_FLASHCARDS_PER_USER) {
      throw new BadRequestException(
        `You can keep at most ${MAX_FLASHCARDS_PER_USER} flashcards.`,
      );
    }
    const result = await this.prisma.flashcard.createMany({
      data: dto.cards.map((c) => ({
        userId,
        front: c.front,
        back: c.back,
        areaId: c.areaId ?? null,
      })),
    });
    return { created: result.count };
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

  /** Repoe a agenda de um cartao (desfazer a ultima classificacao). */
  async restore(userId: string, id: string, dto: RestoreFlashcardDto) {
    const { count } = await this.prisma.flashcard.updateMany({
      where: { id, userId },
      data: {
        dueAt: new Date(dto.dueAt),
        intervalDays: dto.intervalDays,
        ease: dto.ease,
        reps: dto.reps,
        lapses: dto.lapses,
      },
    });
    if (count === 0) throw new NotFoundException('Flashcard not found.');
    return this.prisma.flashcard.findFirstOrThrow({
      where: { id, userId },
      select: SELECT,
    });
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
