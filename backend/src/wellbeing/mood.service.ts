import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { diffUtcDays, parseDateKey, toDateKey } from '../common/date-key.util';
import { MoodRangeQueryDto, UpsertMoodDto } from './dto/mood.dto';
import { MAX_MOOD_RANGE_DAYS } from './wellbeing.constants';

export interface MoodLogView {
  date: string;
  mood: number;
  energy: number | null;
  stress: number | null;
  note: string | null;
}

const MOOD_SELECT = {
  date: true,
  mood: true,
  energy: true,
  stress: true,
  note: true,
} as const;

function toView(row: {
  date: Date;
  mood: number;
  energy: number | null;
  stress: number | null;
  note: string | null;
}): MoodLogView {
  return { ...row, date: toDateKey(row.date) };
}

// Registo diario do estado mental. Um registo por dia (upsert), sempre
// filtrado pelo dono.
@Injectable()
export class MoodService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: MoodRangeQueryDto): Promise<MoodLogView[]> {
    const from = parseDateKey(query.from);
    const to = parseDateKey(query.to);
    const span = diffUtcDays(from, to) + 1;
    if (Number.isNaN(span) || span < 1 || span > MAX_MOOD_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range must cover between 1 and ${MAX_MOOD_RANGE_DAYS} days.`,
      );
    }
    const rows = await this.prisma.moodLog.findMany({
      where: { userId, date: { gte: from, lte: to } },
      select: MOOD_SELECT,
      orderBy: { date: 'asc' },
    });
    return rows.map(toView);
  }

  async upsert(
    userId: string,
    dateKey: string,
    dto: UpsertMoodDto,
  ): Promise<MoodLogView> {
    const date = parseDateKey(dateKey);
    const data = {
      mood: dto.mood,
      energy: dto.energy ?? null,
      stress: dto.stress ?? null,
      note: dto.note?.trim() || null,
    };
    const row = await this.prisma.moodLog.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...data },
      update: data,
      select: MOOD_SELECT,
    });
    return toView(row);
  }

  async remove(userId: string, dateKey: string): Promise<void> {
    const { count } = await this.prisma.moodLog.deleteMany({
      where: { userId, date: parseDateKey(dateKey) },
    });
    if (count === 0) throw new NotFoundException('Mood entry not found.');
  }
}
