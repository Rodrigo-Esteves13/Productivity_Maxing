import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addUtcDays, parseDateKey } from '../common/date-key.util';
import { CopyWeekDto } from './dto/copy-week.dto';
import {
  planWeekCopy,
  ShiftDraft,
  ShiftSource,
} from './work-shift-copy.planner';
import {
  SHIFT_SELECT,
  toShiftView,
  WorkShiftView,
} from './work-shifts.service';
import {
  DAYS_PER_WEEK,
  MAX_SHIFTS_PER_USER,
  WEEK_START_DAY,
} from './work-shifts.constants';

export interface CopyWeekResult {
  created: WorkShiftView[];
  // Já existiam no destino com o mesmo local, dia e horas.
  skipped: number;
  // Quantos turnos pontuais a semana de origem tinha.
  sourceCount: number;
}

const COPY_FIELDS = {
  commitmentId: true,
  label: true,
  bufferMinutes: true,
  date: true,
  dayOfWeek: true,
  startMinutes: true,
  endMinutes: true,
} as const;

@Injectable()
export class WorkShiftCopyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Copia os turnos pontuais de uma semana para outra semana ('one-off')
   * ou fixa-os como semanais ('fixed'). Os turnos que já são semanais não
   * se copiam: já valem para todas as semanas.
   */
  async copyWeek(userId: string, dto: CopyWeekDto): Promise<CopyWeekResult> {
    const fromWeekStart = this.parseWeekStart(
      dto.fromWeekStart,
      'fromWeekStart',
    );
    const toWeekStart = this.resolveTarget(dto, fromWeekStart);

    const rows = await this.prisma.workShift.findMany({
      where: {
        userId,
        date: {
          gte: fromWeekStart,
          lt: addUtcDays(fromWeekStart, DAYS_PER_WEEK),
        },
      },
      select: COPY_FIELDS,
    });
    const sources: ShiftSource[] = rows.flatMap((row) =>
      row.date ? [{ ...row, date: row.date }] : [],
    );

    const existing = await this.loadExisting(userId, dto, toWeekStart);
    const plan = planWeekCopy(dto.mode, sources, existing, {
      fromWeekStart,
      toWeekStart,
    });

    await this.assertRoomFor(userId, plan.toCreate.length);

    // Transação: a semana copia-se inteira ou não se copia nada.
    const created = await this.prisma.$transaction(
      plan.toCreate.map((draft) =>
        this.prisma.workShift.create({
          data: {
            userId,
            commitmentId: draft.commitmentId,
            label: draft.label,
            bufferMinutes: draft.bufferMinutes,
            dayOfWeek: draft.dayOfWeek,
            date: draft.dateKey ? parseDateKey(draft.dateKey) : null,
            startMinutes: draft.startMinutes,
            endMinutes: draft.endMinutes,
          },
          select: SHIFT_SELECT,
        }),
      ),
    );

    return {
      created: created.map(toShiftView),
      skipped: plan.skipped,
      sourceCount: sources.length,
    };
  }

  // Para 'fixed' o destino é "todas as semanas": a semana de origem serve
  // de referência e não há semana de destino.
  private resolveTarget(dto: CopyWeekDto, fromWeekStart: Date): Date {
    if (dto.mode === 'fixed') return fromWeekStart;
    if (!dto.toWeekStart) {
      throw new BadRequestException('toWeekStart is required to copy a week.');
    }
    const toWeekStart = this.parseWeekStart(dto.toWeekStart, 'toWeekStart');
    if (toWeekStart.getTime() === fromWeekStart.getTime()) {
      throw new BadRequestException('Pick a different week to copy into.');
    }
    return toWeekStart;
  }

  private parseWeekStart(key: string, field: string): Date {
    const date = parseDateKey(key);
    if (Number.isNaN(date.getTime()) || date.getUTCDay() !== WEEK_START_DAY) {
      throw new BadRequestException(`${field} must be a valid Monday.`);
    }
    return date;
  }

  // Turnos que já estão no destino, no mesmo formato dos rascunhos.
  private async loadExisting(
    userId: string,
    dto: CopyWeekDto,
    toWeekStart: Date,
  ): Promise<ShiftDraft[]> {
    const where =
      dto.mode === 'fixed'
        ? { userId, dayOfWeek: { not: null } }
        : {
            userId,
            date: {
              gte: toWeekStart,
              lt: addUtcDays(toWeekStart, DAYS_PER_WEEK),
            },
          };
    const rows = await this.prisma.workShift.findMany({
      where,
      select: COPY_FIELDS,
    });
    return rows.map((row) => ({
      commitmentId: row.commitmentId,
      label: row.label,
      bufferMinutes: row.bufferMinutes,
      dayOfWeek: row.dayOfWeek,
      dateKey: row.date ? row.date.toISOString().slice(0, 10) : null,
      startMinutes: row.startMinutes,
      endMinutes: row.endMinutes,
    }));
  }

  private async assertRoomFor(userId: string, toAdd: number): Promise<void> {
    const total = await this.prisma.workShift.count({ where: { userId } });
    if (total + toAdd > MAX_SHIFTS_PER_USER) {
      throw new BadRequestException(
        `You can store at most ${MAX_SHIFTS_PER_USER} work shifts. Delete old ones first.`,
      );
    }
  }
}
