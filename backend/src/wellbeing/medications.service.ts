import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MedicationSchedule, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  parseDateKey,
} from '../common/date-key.util';
import {
  CreateMedicationDto,
  MedicationDoseDto,
  UpdateMedicationDto,
} from './dto/medication.dto';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import {
  MAX_INTAKE_PAST_DAYS,
  MAX_MEDICATIONS_PER_USER,
  MEDICATION_PATH,
  MEDICATION_REMINDER_WINDOW_MINUTES,
  MINUTES_PER_DAY,
} from './wellbeing.constants';

const MEDICATION_SELECT = {
  id: true,
  name: true,
  dosage: true,
  times: true,
  remindersEnabled: true,
  active: true,
  schedule: true,
} as const;

export interface MedicationView {
  id: string;
  name: string;
  dosage: string | null;
  times: number[];
  remindersEnabled: boolean;
  active: boolean;
  schedule: MedicationSchedule;
}

export interface MedicationDaySlot {
  medicationId: string;
  name: string;
  dosage: string | null;
  slotMinutes: number;
  taken: boolean;
}

interface DueDose {
  medicationId: string;
  name: string;
  slotMinutes: number;
}

// Dose a avisar com o dia (de Lisboa) a que pertence: perto da meia-noite
// pode ser uma toma de ontem.
interface DatedDueDose extends DueDose {
  date: Date;
}

// Horas sem repetidos e por ordem: o mesmo minuto duas vezes seria a
// mesma toma (e o unique da dose nao deixaria marcar as duas).
function normalizeTimes(times: number[]): number[] {
  return [...new Set(times)].sort((a, b) => a - b);
}

// "Se necessario" nao tem horas; diario precisa de pelo menos uma.
function timesFor(schedule: MedicationSchedule, times: number[]): number[] {
  if (schedule === MedicationSchedule.AS_NEEDED) return [];
  const normalized = normalizeTimes(times);
  if (normalized.length === 0) {
    throw new BadRequestException(
      'Add at least one time for a daily medication.',
    );
  }
  return normalized;
}

// Tomas a avisar agora: a hora ja passou, ha menos de
// MEDICATION_REMINDER_WINDOW_MINUTES, e a dose ainda nao foi avisada nem
// tomada (`doses` so traz essas). Para as tomas de ontem, `nowMinutes` vem
// somado de MINUTES_PER_DAY.
export function findDueDoses(
  medications: {
    id: string;
    name: string;
    times: number[];
    doses: { slotMinutes: number }[];
  }[],
  nowMinutes: number,
): DueDose[] {
  return medications.flatMap((m) => {
    const handled = new Set(m.doses.map((d) => d.slotMinutes));
    return m.times
      .filter((slot) => {
        const late = nowMinutes - slot;
        return (
          late >= 0 &&
          late <= MEDICATION_REMINDER_WINDOW_MINUTES &&
          !handled.has(slot)
        );
      })
      .map((slotMinutes) => ({
        medicationId: m.id,
        name: m.name,
        slotMinutes,
      }));
  });
}

// Lembretes de medicacao e registo das tomas. Nao e conselho medico.
@Injectable()
export class MedicationsService {
  private readonly logger = new Logger(MedicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushService: PushService,
    private readonly disclaimer: MedicationDisclaimerService,
  ) {}

  list(userId: string): Promise<MedicationView[]> {
    return this.prisma.medication.findMany({
      where: { userId },
      select: MEDICATION_SELECT,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async create(
    userId: string,
    dto: CreateMedicationDto,
  ): Promise<MedicationView> {
    await this.disclaimer.assertAccepted(userId);
    const count = await this.prisma.medication.count({ where: { userId } });
    if (count >= MAX_MEDICATIONS_PER_USER) {
      throw new BadRequestException(
        `You can store at most ${MAX_MEDICATIONS_PER_USER} medications.`,
      );
    }
    const schedule = dto.schedule ?? MedicationSchedule.DAILY;
    return this.prisma.medication.create({
      data: {
        userId,
        name: dto.name.trim(),
        dosage: dto.dosage?.trim() || null,
        schedule,
        times: timesFor(schedule, dto.times ?? []),
        remindersEnabled:
          schedule === MedicationSchedule.DAILY &&
          (dto.remindersEnabled ?? true),
      },
      select: MEDICATION_SELECT,
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMedicationDto,
  ): Promise<MedicationView> {
    const current = await this.prisma.medication.findFirst({
      where: { id, userId },
      select: { schedule: true, times: true },
    });
    if (!current) throw this.notFound();
    const schedule = dto.schedule ?? current.schedule;
    const data: Prisma.MedicationUpdateManyMutationInput = {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.dosage !== undefined && { dosage: dto.dosage.trim() || null }),
      ...((dto.times !== undefined || dto.schedule !== undefined) && {
        schedule,
        times: timesFor(schedule, dto.times ?? current.times),
      }),
      ...(schedule === MedicationSchedule.AS_NEEDED && {
        remindersEnabled: false,
      }),
      ...(dto.remindersEnabled !== undefined &&
        schedule === MedicationSchedule.DAILY && {
          remindersEnabled: dto.remindersEnabled,
        }),
      ...(dto.active !== undefined && { active: dto.active }),
    };
    const { count } = await this.prisma.medication.updateMany({
      where: { id, userId },
      data,
    });
    if (count === 0) throw this.notFound();
    const row = await this.prisma.medication.findFirst({
      where: { id, userId },
      select: MEDICATION_SELECT,
    });
    if (!row) throw this.notFound();
    return row;
  }

  async remove(userId: string, id: string): Promise<void> {
    // deleteMany com userId: um id de outro utilizador e "nao existe".
    const { count } = await this.prisma.medication.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw this.notFound();
  }

  // Checklist de um dia: cada toma de cada medicamento ativo, e se ja foi.
  async day(userId: string, dateKey?: string): Promise<MedicationDaySlot[]> {
    const date = dateKey ? parseDateKey(dateKey) : getLisbonNow().today;
    const [medications, doses] = await Promise.all([
      this.prisma.medication.findMany({
        where: { userId, active: true, schedule: MedicationSchedule.DAILY },
        select: { id: true, name: true, dosage: true, times: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.medicationDose.findMany({
        where: { userId, date, takenAt: { not: null } },
        select: { medicationId: true, slotMinutes: true },
      }),
    ]);
    const taken = new Set(
      doses.map((d) => `${d.medicationId}:${d.slotMinutes}`),
    );
    return medications
      .flatMap((m) =>
        m.times.map((slotMinutes) => ({
          medicationId: m.id,
          name: m.name,
          dosage: m.dosage,
          slotMinutes,
          taken: taken.has(`${m.id}:${slotMinutes}`),
        })),
      )
      .sort(
        (a, b) => a.slotMinutes - b.slotMinutes || a.name.localeCompare(b.name),
      );
  }

  async setDose(
    userId: string,
    medicationId: string,
    dto: MedicationDoseDto,
  ): Promise<void> {
    const medication = await this.prisma.medication.findFirst({
      where: { id: medicationId, userId },
      select: { times: true },
    });
    if (!medication) throw this.notFound();
    if (!medication.times.includes(dto.slotMinutes)) {
      throw new BadRequestException(
        'That time is not one of the doses of this medication.',
      );
    }
    const date = parseDateKey(dto.date);
    // Da para marcar um dia que passou (esqueceu-se de registar), mas nao
    // um dia futuro nem muito antigo.
    const daysAgo = diffUtcDays(date, getLisbonNow().today);
    if (
      Number.isNaN(daysAgo) ||
      daysAgo < 0 ||
      daysAgo > MAX_INTAKE_PAST_DAYS
    ) {
      throw new BadRequestException(
        `The day must be in the last ${MAX_INTAKE_PAST_DAYS} days and not in the future.`,
      );
    }
    const takenAt = dto.taken ? new Date() : null;
    await this.prisma.medicationDose.upsert({
      where: {
        medicationId_date_slotMinutes: {
          medicationId,
          date,
          slotMinutes: dto.slotMinutes,
        },
      },
      create: {
        userId,
        medicationId,
        date,
        slotMinutes: dto.slotMinutes,
        takenAt,
      },
      update: { takenAt },
    });
  }

  /**
   * Chamado pelo cron dos lembretes (RemindersService.run). Um push por
   * utilizador com as tomas a avisar agora. Devolve quantos foram avisados.
   */
  async sendDueReminders(): Promise<number> {
    const { today, nowMinutes } = getLisbonNow();
    // O cron corre de 15 em 15 min (e o GitHub atrasa): uma toma as 23:50
    // so fica "a horas" depois da meia-noite. Na primeira hora do dia
    // revemos tambem as tomas de ontem, com o relogio de ontem (+1440).
    const passes = [{ date: today, nowMinutes }];
    if (nowMinutes < MEDICATION_REMINDER_WINDOW_MINUTES) {
      passes.push({
        date: addUtcDays(today, -1),
        nowMinutes: nowMinutes + MINUTES_PER_DAY,
      });
    }

    const dueByUser = new Map<string, DatedDueDose[]>();
    for (const pass of passes) {
      const medications = await this.findReminderCandidates(pass.date);
      for (const m of medications) {
        const due = findDueDoses([m], pass.nowMinutes).map((d) => ({
          ...d,
          date: pass.date,
        }));
        if (due.length === 0) continue;
        dueByUser.set(m.userId, [...(dueByUser.get(m.userId) ?? []), ...due]);
      }
    }

    let usersPushed = 0;
    for (const [userId, due] of dueByUser) {
      // Sem o nome do medicamento: a notificacao aparece no ecra bloqueado
      // e o nome e dado de saude. O texto lembra de confirmar que ainda nao
      // tomou, para evitar uma toma a dobrar.
      const medicationCount = new Set(due.map((d) => d.medicationId)).size;
      const delivered = await this.pushService.notifyUser(
        userId,
        medicationCount === 1 ? 'medicationDue' : 'medicationsDue',
        { url: MEDICATION_PATH },
      );
      // Sem dispositivo com push: nao marca, tenta na proxima execucao.
      if (delivered === 0) continue;
      usersPushed += 1;
      await this.markReminded(userId, due);
    }
    if (usersPushed > 0) {
      this.logger.log(`Medicacao: ${usersPushed} utilizadores avisados`);
    }
    return usersPushed;
  }

  // Medicamentos com lembrete e as doses desse dia que ja contam como
  // tratadas. Uma linha com takenAt e remindedAt a null (marcou e desmarcou
  // antes da hora) NAO cancela o lembrete.
  private findReminderCandidates(date: Date) {
    return this.prisma.medication.findMany({
      where: {
        active: true,
        remindersEnabled: true,
        schedule: MedicationSchedule.DAILY,
        user: { status: { not: UserStatus.BANNED } },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        times: true,
        doses: {
          where: {
            date,
            OR: [{ takenAt: { not: null } }, { remindedAt: { not: null } }],
          },
          select: { slotMinutes: true },
        },
      },
    });
  }

  // Upsert (e nao createMany com skipDuplicates): se ja existe a linha de
  // um "desmarcar", o remindedAt tem de ficar gravado, senao o mesmo
  // lembrete repetia-se a cada execucao do cron durante a janela.
  private async markReminded(userId: string, due: DatedDueDose[]) {
    const remindedAt = new Date();
    for (const d of due) {
      await this.prisma.medicationDose.upsert({
        where: {
          medicationId_date_slotMinutes: {
            medicationId: d.medicationId,
            date: d.date,
            slotMinutes: d.slotMinutes,
          },
        },
        create: {
          userId,
          medicationId: d.medicationId,
          date: d.date,
          slotMinutes: d.slotMinutes,
          remindedAt,
        },
        update: { remindedAt },
      });
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      `Medication not found or you don't have access.`,
    );
  }
}
