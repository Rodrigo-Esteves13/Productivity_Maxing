import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ScheduleExceptionKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  parseDateKey,
} from '../common/date-key.util';
import { CreateScheduleExceptionDto } from './dto/schedule-exception.dto';
import {
  EXCEPTION_LIST_PAST_DAYS,
  MAX_EXCEPTION_DAYS,
  MAX_EXCEPTIONS_PER_USER,
} from './work-shifts.constants';

const EXCEPTION_SELECT = {
  id: true,
  kind: true,
  shiftId: true,
  commitmentId: true,
  startsOn: true,
  endsOn: true,
  startMinutes: true,
  endMinutes: true,
  note: true,
} as const;

export interface ScheduleExceptionView {
  id: string;
  kind: ScheduleExceptionKind;
  shiftId: string | null;
  commitmentId: string | null;
  startsOn: Date;
  endsOn: Date;
  startMinutes: number | null;
  endMinutes: number | null;
  note: string | null;
}

// Excecoes ao horario semanal: folga num dia, nova hora numa semana,
// ferias. Quem as aplica e o WorkShiftsService.expandRange; isto so as
// guarda, com a validacao de dono e de forma.
@Injectable()
export class ScheduleExceptionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** As que ainda contam (e as acabadas ha pouco, para as poder rever). */
  list(userId: string): Promise<ScheduleExceptionView[]> {
    const since = addUtcDays(getLisbonNow().today, -EXCEPTION_LIST_PAST_DAYS);
    return this.prisma.scheduleException.findMany({
      where: { userId, endsOn: { gte: since } },
      orderBy: [{ startsOn: 'asc' }, { createdAt: 'asc' }],
      select: EXCEPTION_SELECT,
    });
  }

  async create(
    userId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleExceptionView> {
    const startsOn = parseDateKey(dto.startsOn);
    const endsOn = parseDateKey(dto.endsOn);
    const span = diffUtcDays(startsOn, endsOn) + 1;
    if (Number.isNaN(span) || span < 1) {
      throw new BadRequestException(
        'The last day must be on or after the first day.',
      );
    }
    if (span > MAX_EXCEPTION_DAYS) {
      throw new BadRequestException(
        `A change can cover at most ${MAX_EXCEPTION_DAYS} days. To change it for good, edit the shift.`,
      );
    }
    if (dto.shiftId && dto.commitmentId) {
      throw new BadRequestException(
        'Send either shiftId or commitmentId, not both.',
      );
    }

    const isRetime = dto.kind === 'RETIME';
    if (isRetime) {
      // Um turno, ou todos os de um local ("na proxima semana entro as
      // 10h"); nunca todos de todo o lado (horas diferentes por local).
      if (!dto.shiftId && !dto.commitmentId) {
        throw new BadRequestException(
          'A new time needs the shift or place it applies to.',
        );
      }
      if (
        dto.startMinutes === undefined ||
        dto.endMinutes === undefined ||
        dto.startMinutes >= dto.endMinutes
      ) {
        throw new BadRequestException(
          'The new start time must be before the end time.',
        );
      }
    }

    await this.assertTargetOwned(userId, dto);
    const count = await this.prisma.scheduleException.count({
      where: { userId },
    });
    if (count >= MAX_EXCEPTIONS_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${MAX_EXCEPTIONS_PER_USER} schedule changes. Remove old ones first.`,
      );
    }

    return this.prisma.scheduleException.create({
      data: {
        userId,
        kind: dto.kind,
        shiftId: dto.shiftId ?? null,
        commitmentId: dto.commitmentId ?? null,
        startsOn,
        endsOn,
        startMinutes: isRetime ? dto.startMinutes : null,
        endMinutes: isRetime ? dto.endMinutes : null,
        note: dto.note || null,
      },
      select: EXCEPTION_SELECT,
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.scheduleException.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException('Schedule change not found.');
  }

  // Turno ou local de outra pessoa falha como "nao existe". So turnos
  // semanais: um pontual muda-se editando-o.
  private async assertTargetOwned(
    userId: string,
    dto: CreateScheduleExceptionDto,
  ): Promise<void> {
    if (dto.shiftId) {
      const shift = await this.prisma.workShift.findFirst({
        where: { id: dto.shiftId, userId },
        select: { dayOfWeek: true },
      });
      if (!shift) throw new NotFoundException('Work shift not found.');
      if (shift.dayOfWeek === null) {
        throw new BadRequestException(
          'One-off shifts are changed by editing them.',
        );
      }
    }
    if (dto.commitmentId) {
      const owned = await this.prisma.commitment.count({
        where: { id: dto.commitmentId, userId },
      });
      if (owned === 0) throw new NotFoundException('Commitment not found.');
    }
  }
}
