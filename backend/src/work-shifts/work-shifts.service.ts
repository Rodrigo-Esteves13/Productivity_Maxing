import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type CommuteMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import {
  CreateWorkShiftDto,
  CreateWorkShiftsDto,
} from './dto/create-work-shifts.dto';
import { UpdateWorkShiftDto } from './dto/update-work-shift.dto';
import { MAX_RANGE_DAYS, MAX_SHIFTS_PER_USER } from './work-shifts.constants';
import { isDayOff } from './days-off.util';

export const SHIFT_SELECT = {
  id: true,
  dayOfWeek: true,
  date: true,
  startsOn: true,
  startMinutes: true,
  endMinutes: true,
  bufferMinutes: true,
  label: true,
  address: true,
  commuteMode: true,
  commitmentId: true,
  commitment: {
    select: {
      name: true,
      commuteMinutes: true,
      daysOff: true,
      endsOn: true,
      address: true,
      commuteMode: true,
    },
  },
} satisfies Prisma.WorkShiftSelect;

type ShiftRow = Prisma.WorkShiftGetPayload<{ select: typeof SHIFT_SELECT }>;

export interface WorkShiftView {
  id: string;
  dayOfWeek: number | null;
  date: Date | null;
  startsOn: Date | null;
  startMinutes: number;
  endMinutes: number;
  commitmentId: string | null;
  label: string | null;
  bufferMinutes: number;
  // Morada (do local, ou do proprio evento pontual) e meio de transporte
  // para o itinerario do dia. null = desconhecido / o do utilizador.
  address: string | null;
  commuteMode: CommuteMode | null;
}

// O que a API devolve de um turno: nome e deslocação já resolvidos a
// partir do local (quando existe), para o cliente não repetir a regra.
export function toShiftView(shift: ShiftRow): WorkShiftView {
  return {
    id: shift.id,
    dayOfWeek: shift.dayOfWeek,
    date: shift.date,
    startsOn: shift.startsOn,
    startMinutes: shift.startMinutes,
    endMinutes: shift.endMinutes,
    commitmentId: shift.commitmentId,
    label: shift.commitment?.name ?? shift.label,
    bufferMinutes: shift.commitment?.commuteMinutes ?? shift.bufferMinutes,
    address: shift.commitment ? shift.commitment.address : shift.address,
    commuteMode: shift.commitment
      ? shift.commitment.commuteMode
      : shift.commuteMode,
  };
}

// Um turno já expandido para um dia concreto. `shiftId` aponta para o
// registo original (recorrente ou pontual), que é o que o DELETE usa.
export interface WorkShiftOccurrence {
  shiftId: string;
  commitmentId: string | null;
  date: string; // YYYY-MM-DD
  startMinutes: number;
  endMinutes: number;
  bufferMinutes: number;
  label: string | null;
  isRecurring: boolean;
  address: string | null;
  commuteMode: CommuteMode | null;
}

@Injectable()
export class WorkShiftsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<WorkShiftView[]> {
    const rows = await this.prisma.workShift.findMany({
      where: { userId },
      select: SHIFT_SELECT,
      orderBy: [{ dayOfWeek: 'asc' }, { date: 'asc' }, { startMinutes: 'asc' }],
    });
    return rows.map(toShiftView);
  }

  async createMany(
    userId: string,
    dto: CreateWorkShiftsDto,
  ): Promise<WorkShiftView[]> {
    dto.shifts.forEach((shift, index) =>
      this.assertValidNewShift(shift, index),
    );
    const daysOffByCommitment = await this.assertCommitmentsOwned(
      userId,
      dto.shifts.map((s) => s.commitmentId),
    );

    // Folga fixa: um turno SEMANAL num dia de folga do local é saltado (nunca
    // criado). Pontuais ficam sempre: escolher uma data concreta é uma troca
    // de folga deliberada.
    const shifts = dto.shifts.filter(
      (shift) =>
        !(
          shift.commitmentId &&
          isDayOff(
            daysOffByCommitment.get(shift.commitmentId),
            shift.dayOfWeek ?? null,
          )
        ),
    );
    if (shifts.length === 0) return [];

    const existing = await this.prisma.workShift.count({ where: { userId } });
    if (existing + shifts.length > MAX_SHIFTS_PER_USER) {
      throw new BadRequestException(
        `You can store at most ${MAX_SHIFTS_PER_USER} work shifts. Delete old ones first.`,
      );
    }

    // Transação: ou entram todos ou nenhum, para um pedido com um turno
    // inválido a meio nunca deixar metade da semana gravada.
    const rows = await this.prisma.$transaction(
      shifts.map((shift) =>
        this.prisma.workShift.create({
          data: {
            userId,
            commitmentId: shift.commitmentId ?? null,
            dayOfWeek: shift.dayOfWeek ?? null,
            date: shift.date ? parseDateKey(shift.date) : null,
            startsOn:
              shift.dayOfWeek !== undefined && shift.startsOn
                ? parseDateKey(shift.startsOn)
                : null,
            startMinutes: shift.startMinutes,
            endMinutes: shift.endMinutes,
            bufferMinutes: shift.bufferMinutes ?? 0,
            label: shift.label?.trim() || null,
            address: shift.address?.trim() || null,
            commuteMode: shift.commuteMode ?? null,
          },
          select: SHIFT_SELECT,
        }),
      ),
    );
    return rows.map(toShiftView);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateWorkShiftDto,
  ): Promise<WorkShiftView> {
    if (dto.dayOfWeek !== undefined && dto.date !== undefined) {
      throw new BadRequestException(
        'Send either dayOfWeek (weekly) or date (one-off), not both.',
      );
    }

    const current = await this.prisma.workShift.findFirst({
      where: { id, userId },
      select: {
        startMinutes: true,
        endMinutes: true,
        dayOfWeek: true,
        commitment: { select: { daysOff: true } },
      },
    });
    if (!current) throw this.notFound();

    // Valida o resultado FINAL (campos novos por cima dos atuais): enviar
    // só `endMinutes` não pode deixar o turno com fim antes do início.
    const startMinutes = dto.startMinutes ?? current.startMinutes;
    const endMinutes = dto.endMinutes ?? current.endMinutes;
    if (startMinutes >= endMinutes) {
      throw new BadRequestException(
        'Start time must be before end time. Split overnight shifts into two entries.',
      );
    }
    // Folgas do local FINAL (o novo, se mudou; null = solto, sem folgas) e
    // dia da semana FINAL (trocar para data pontual anula o semanal).
    const targetDaysOff =
      dto.commitmentId === undefined
        ? current.commitment?.daysOff
        : dto.commitmentId === null
          ? undefined
          : (await this.assertCommitmentsOwned(userId, [dto.commitmentId])).get(
              dto.commitmentId,
            );
    const finalWeekday =
      dto.date !== undefined ? null : (dto.dayOfWeek ?? current.dayOfWeek);
    if (isDayOff(targetDaysOff, finalWeekday)) {
      throw new BadRequestException(
        'That weekday is a fixed day off at this place. Remove it from the days off first.',
      );
    }

    const { count } = await this.prisma.workShift.updateMany({
      where: { id, userId },
      data: {
        startMinutes,
        endMinutes,
        ...(dto.bufferMinutes !== undefined && {
          bufferMinutes: dto.bufferMinutes,
        }),
        ...(dto.label !== undefined && { label: dto.label.trim() || null }),
        ...(dto.address !== undefined && {
          address: dto.address.trim() || null,
        }),
        ...(dto.commuteMode !== undefined && { commuteMode: dto.commuteMode }),
        ...(dto.commitmentId !== undefined && {
          commitmentId: dto.commitmentId,
        }),
        // Trocar a recorrência anula a outra metade (regra "exatamente um").
        ...(dto.dayOfWeek !== undefined && {
          dayOfWeek: dto.dayOfWeek,
          date: null,
        }),
        ...(dto.startsOn !== undefined && {
          startsOn: dto.startsOn === null ? null : parseDateKey(dto.startsOn),
        }),
        // Um turno pontual nao tem inicio de recorrencia.
        ...(dto.date !== undefined && {
          date: parseDateKey(dto.date),
          dayOfWeek: null,
          startsOn: null,
        }),
      },
    });
    if (count === 0) throw this.notFound();

    const updated = await this.prisma.workShift.findFirst({
      where: { id, userId },
      select: SHIFT_SELECT,
    });
    if (!updated) throw this.notFound();
    return toShiftView(updated);
  }

  async remove(userId: string, id: string): Promise<void> {
    // deleteMany com userId no where: um id de outro utilizador devolve
    // count 0, indistinguível de "não existe" (sem IDOR, sem enumeração).
    const { count } = await this.prisma.workShift.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw this.notFound();
  }

  /**
   * Expande turnos recorrentes e pontuais para cada dia do intervalo
   * (inclusive). Usado pela vista semanal, pelo StudyPlanService e pelo
   * sync do Google Calendar.
   */
  async expandRange(
    userId: string,
    fromKey: string,
    toKey: string,
  ): Promise<WorkShiftOccurrence[]> {
    const from = parseDateKey(fromKey);
    const to = parseDateKey(toKey);
    const spanDays = diffUtcDays(from, to) + 1;
    if (Number.isNaN(spanDays) || spanDays < 1 || spanDays > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Date range must cover between 1 and ${MAX_RANGE_DAYS} days.`,
      );
    }

    const rows = await this.prisma.workShift.findMany({
      where: {
        userId,
        OR: [{ dayOfWeek: { not: null } }, { date: { gte: from, lte: to } }],
      },
      select: SHIFT_SELECT,
    });
    const shifts = rows.map((row) => ({ row, view: toShiftView(row) }));

    const occurrences: WorkShiftOccurrence[] = [];
    for (let i = 0; i < spanDays; i++) {
      const day = addUtcDays(from, i);
      const key = toDateKey(day);
      const weekday = day.getUTCDay();

      for (const { row, view } of shifts) {
        // Folga fixa do local: o turno semanal não vale nesse dia (fica
        // guardado, volta a valer se a folga for retirada).
        // Antes de startsOn o turno semanal ainda nao comecou.
        const matchesRecurring =
          row.dayOfWeek === weekday &&
          (row.startsOn === null || row.startsOn <= day) &&
          !isDayOff(row.commitment?.daysOff, weekday) &&
          // Depois do ultimo dia do contrato o turno semanal acaba.
          !(row.commitment?.endsOn && row.commitment.endsOn < day);
        const matchesOneOff = row.date !== null && toDateKey(row.date) === key;
        if (!matchesRecurring && !matchesOneOff) continue;

        occurrences.push({
          shiftId: view.id,
          commitmentId: view.commitmentId,
          date: key,
          startMinutes: view.startMinutes,
          endMinutes: view.endMinutes,
          bufferMinutes: view.bufferMinutes,
          label: view.label,
          isRecurring: row.dayOfWeek !== null,
          address: view.address,
          commuteMode: view.commuteMode,
        });
      }
    }

    return occurrences.sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes,
    );
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      `Work shift not found or you don't have access.`,
    );
  }

  // Um commitmentId de outro utilizador tem de falhar como "não existe".
  // Devolve as folgas fixas de cada local (id -> dias), para quem as precisa.
  private async assertCommitmentsOwned(
    userId: string,
    commitmentIds: (string | undefined)[],
  ): Promise<Map<string, number[]>> {
    const unique = [
      ...new Set(commitmentIds.filter((id): id is string => !!id)),
    ];
    if (unique.length === 0) return new Map();

    const owned = await this.prisma.commitment.findMany({
      where: { userId, id: { in: unique } },
      select: { id: true, daysOff: true },
    });
    if (owned.length !== unique.length) {
      throw new NotFoundException(
        `Commitment not found or you don't have access.`,
      );
    }
    return new Map(owned.map((c) => [c.id, c.daysOff]));
  }

  // O Prisma não expressa "exatamente um de dois campos" no schema, por
  // isso a regra vive aqui, à entrada de cada escrita.
  private assertValidNewShift(shift: CreateWorkShiftDto, index: number): void {
    const hasWeekday = shift.dayOfWeek !== undefined;
    const hasDate = shift.date !== undefined;
    const row = `Shift ${index + 1}`;

    if (hasWeekday === hasDate) {
      throw new BadRequestException(
        `${row}: send either dayOfWeek (weekly) or date (one-off), not both or neither.`,
      );
    }
    if (shift.startMinutes >= shift.endMinutes) {
      throw new BadRequestException(
        `${row}: start time must be before end time. Split overnight shifts into two entries.`,
      );
    }
  }
}
