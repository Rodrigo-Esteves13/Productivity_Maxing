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
import { MS_PER_MINUTE } from '../common/time.constants';
import {
  CreateMedicationDto,
  MedicationDoseDto,
  UpdateMedicationDto,
} from './dto/medication.dto';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import {
  MAX_INTAKE_PAST_DAYS,
  MAX_MEDICATIONS_PER_USER,
  MEDICATION_FOLLOW_UP_DELAY_MINUTES,
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

// Como esta execucao ficou com a toma: criou a linha, ou marcou a linha de
// um "desmarcar". Diz como desfazer o claim se o push nao chegar.
type ClaimKind = 'created' | 'updated';

interface ClaimedDose extends DatedDueDose {
  how: ClaimKind;
}

const PRISMA_UNIQUE_VIOLATION = 'P2002';

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === PRISMA_UNIQUE_VIOLATION;
}

// Chave de uma toma, sempre com o dono (userId).
function slotWhere(userId: string, d: DatedDueDose) {
  return {
    userId,
    medicationId: d.medicationId,
    date: d.date,
    slotMinutes: d.slotMinutes,
  };
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

// Tomas a reavisar agora (segundo e ultimo aviso): ja avisadas ha pelo menos
// MEDICATION_FOLLOW_UP_DELAY_MINUTES, ainda por tomar, sem segundo aviso, e
// ainda dentro de MEDICATION_REMINDER_WINDOW_MINUTES depois da hora marcada.
// `doses` traz as linhas do dia; `nowMinutes` como em findDueDoses.
export function findFollowUpDoses(
  medications: {
    id: string;
    name: string;
    times: number[];
    doses: {
      slotMinutes: number;
      takenAt: Date | null;
      remindedAt: Date | null;
      followUpRemindedAt: Date | null;
    }[];
  }[],
  nowMinutes: number,
  now: Date,
): DueDose[] {
  const delayMs = MEDICATION_FOLLOW_UP_DELAY_MINUTES * MS_PER_MINUTE;
  return medications.flatMap((m) =>
    m.doses
      .filter((d) => {
        const late = nowMinutes - d.slotMinutes;
        return (
          m.times.includes(d.slotMinutes) &&
          d.takenAt === null &&
          d.followUpRemindedAt === null &&
          d.remindedAt !== null &&
          now.getTime() - d.remindedAt.getTime() >= delayMs &&
          late >= 0 &&
          late <= MEDICATION_REMINDER_WINDOW_MINUTES
        );
      })
      .map((d) => ({
        medicationId: m.id,
        name: m.name,
        slotMinutes: d.slotMinutes,
      })),
  );
}

export type ReminderSlotState =
  'taken' | 'reminded' | 'due' | 'upcoming' | 'missed';

export interface ReminderSlotStatus {
  slotMinutes: number;
  state: ReminderSlotState;
  remindedAt: string | null;
  followUpRemindedAt: string | null;
  takenAt: string | null;
}

export interface MedicationReminderStatus {
  medicationId: string;
  slots: ReminderSlotStatus[];
}

export interface MedicationReminderStatusView {
  windowMinutes: number;
  medications: MedicationReminderStatus[];
}

// Estado de cada toma de hoje para o ecra de diagnostico. `doses` so deve
// trazer as linhas de hoje. A janela e inclusiva: exatamente WINDOW minutos
// depois ainda e "due".
export function computeReminderSlotStates(
  times: number[],
  doses: {
    slotMinutes: number;
    takenAt: Date | null;
    remindedAt: Date | null;
    followUpRemindedAt?: Date | null;
  }[],
  nowMinutes: number,
): ReminderSlotStatus[] {
  const bySlot = new Map(doses.map((d) => [d.slotMinutes, d]));
  return [...times]
    .sort((a, b) => a - b)
    .map((slotMinutes) => {
      const dose = bySlot.get(slotMinutes);
      const takenAt = dose?.takenAt ?? null;
      const remindedAt = dose?.remindedAt ?? null;
      const followUpRemindedAt = dose?.followUpRemindedAt ?? null;
      const late = nowMinutes - slotMinutes;
      let state: ReminderSlotState;
      if (takenAt) state = 'taken';
      else if (remindedAt) state = 'reminded';
      else if (late < 0) state = 'upcoming';
      else if (late <= MEDICATION_REMINDER_WINDOW_MINUTES) state = 'due';
      else state = 'missed';
      return {
        slotMinutes,
        state,
        remindedAt: remindedAt ? remindedAt.toISOString() : null,
        followUpRemindedAt: followUpRemindedAt
          ? followUpRemindedAt.toISOString()
          : null,
        takenAt: takenAt ? takenAt.toISOString() : null,
      };
    });
}

// Lembretes de medicacao e registo das tomas. Nao e conselho medico.
@Injectable()
export class MedicationsService {
  private readonly logger = new Logger(MedicationsService.name);
  // Execucao de sendDueReminders em curso (single-flight).
  private reminderRun: Promise<number> | null = null;

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

  // Diagnostico dos lembretes de hoje: so do proprio utilizador, so
  // medicamentos diarios, ativos e com lembrete ligado.
  async reminderStatus(userId: string): Promise<MedicationReminderStatusView> {
    const { today, nowMinutes } = getLisbonNow();
    const medications = await this.prisma.medication.findMany({
      where: {
        userId,
        active: true,
        remindersEnabled: true,
        schedule: MedicationSchedule.DAILY,
      },
      select: {
        id: true,
        times: true,
        doses: {
          where: { userId, date: today },
          select: {
            slotMinutes: true,
            takenAt: true,
            remindedAt: true,
            followUpRemindedAt: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return {
      windowMinutes: MEDICATION_REMINDER_WINDOW_MINUTES,
      medications: medications.map((m) => ({
        medicationId: m.id,
        slots: computeReminderSlotStates(m.times, m.doses, nowMinutes),
      })),
    };
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
   * Chamado pelo cron dos lembretes (RemindersService.run) e pelo agendador
   * interno (MedicationReminderSchedulerService). Um push por utilizador com
   * as tomas a avisar agora, e outro (no maximo um por toma) com as tomas ja
   * avisadas que continuam por tomar (ver findFollowUpDoses). Devolve
   * quantos pushes chegaram a pelo menos um dispositivo.
   *
   * Single-flight: se ja ha uma execucao neste processo, devolve a mesma
   * promessa (o cron e o agendador nunca correm por cima um do outro). Entre
   * instancias, quem impede o envio a dobrar e o claim de cada toma (ver
   * claimSlot).
   */
  sendDueReminders(): Promise<number> {
    if (this.reminderRun) return this.reminderRun;
    const run = this.runDueReminders().finally(() => {
      this.reminderRun = null;
    });
    this.reminderRun = run;
    return run;
  }

  private async runDueReminders(): Promise<number> {
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

    const now = new Date();
    const dueByUser = new Map<string, DatedDueDose[]>();
    const followUpByUser = new Map<string, DatedDueDose[]>();
    const add = (
      map: Map<string, DatedDueDose[]>,
      userId: string,
      doses: DatedDueDose[],
    ) => {
      if (doses.length === 0) return;
      map.set(userId, [...(map.get(userId) ?? []), ...doses]);
    };
    for (const pass of passes) {
      const medications = await this.findReminderCandidates(pass.date);
      for (const m of medications) {
        const dated = (d: DueDose): DatedDueDose => ({ ...d, date: pass.date });
        add(dueByUser, m.userId, findDueDoses([m], pass.nowMinutes).map(dated));
        add(
          followUpByUser,
          m.userId,
          findFollowUpDoses([m], pass.nowMinutes, now).map(dated),
        );
      }
    }

    let usersPushed = 0;
    for (const [userId, due] of dueByUser) {
      // Claim antes de enviar: so avisa as tomas que ESTA execucao marcou.
      // Outra execucao (cron externo, agendador, outra instancia) que leu as
      // mesmas tomas perde o claim e nao envia.
      const remindedAt = new Date();
      const claimed: ClaimedDose[] = [];
      try {
        for (const d of due) {
          const how = await this.claimSlot(userId, d, remindedAt);
          if (how) claimed.push({ ...d, how });
        }
      } catch (error) {
        // Claims a meio sem push: desfaz para a proxima execucao avisar.
        await this.releaseClaims(userId, claimed, remindedAt);
        throw error;
      }
      if (claimed.length === 0) continue;
      // Sem o nome do medicamento: a notificacao aparece no ecra bloqueado
      // e o nome e dado de saude. O texto lembra de confirmar que ainda nao
      // tomou, para evitar uma toma a dobrar.
      const medicationCount = new Set(claimed.map((d) => d.medicationId)).size;
      let delivered = 0;
      try {
        delivered = await this.pushService.notifyUser(
          userId,
          medicationCount === 1 ? 'medicationDue' : 'medicationsDue',
          { url: MEDICATION_PATH },
        );
      } finally {
        // Sem dispositivo com push: liberta o claim, tenta na proxima execucao.
        if (delivered === 0) {
          await this.releaseClaims(userId, claimed, remindedAt);
        }
      }
      if (delivered > 0) usersPushed += 1;
    }
    let followUpsPushed = 0;
    for (const [userId, due] of followUpByUser) {
      if (await this.sendFollowUp(userId, due)) followUpsPushed += 1;
    }
    if (usersPushed > 0) {
      this.logger.log(`Medicacao: ${usersPushed} utilizadores avisados`);
    }
    if (followUpsPushed > 0) {
      this.logger.log(`Medicacao: ${followUpsPushed} utilizadores reavisados`);
    }
    return usersPushed + followUpsPushed;
  }

  /**
   * Segundo aviso de um utilizador. Mesmo padrao do primeiro: claim de cada
   * toma (followUpRemindedAt, updateMany condicional: avisada, por tomar e
   * sem segundo aviso), push so com o que ESTA execucao reclamou, e se nenhum
   * dispositivo o recebeu liberta o claim para a proxima execucao tentar.
   * Devolve true se o push chegou a algum dispositivo.
   */
  private async sendFollowUp(
    userId: string,
    due: DatedDueDose[],
  ): Promise<boolean> {
    const followUpRemindedAt = new Date();
    const claimed: DatedDueDose[] = [];
    try {
      for (const d of due) {
        const { count } = await this.prisma.medicationDose.updateMany({
          where: {
            ...slotWhere(userId, d),
            takenAt: null,
            remindedAt: { not: null },
            followUpRemindedAt: null,
          },
          data: { followUpRemindedAt },
        });
        if (count > 0) claimed.push(d);
      }
    } catch (error) {
      await this.releaseFollowUps(userId, claimed, followUpRemindedAt);
      throw error;
    }
    if (claimed.length === 0) return false;
    // Sem o nome do medicamento, como o primeiro aviso (ecra bloqueado).
    let delivered = 0;
    try {
      delivered = await this.pushService.notifyUser(
        userId,
        'medicationFollowUp',
        { url: MEDICATION_PATH },
      );
    } finally {
      if (delivered === 0) {
        await this.releaseFollowUps(userId, claimed, followUpRemindedAt);
      }
    }
    return delivered > 0;
  }

  // Desfaz so o segundo aviso reclamado por esta execucao.
  private async releaseFollowUps(
    userId: string,
    claimed: DatedDueDose[],
    followUpRemindedAt: Date,
  ) {
    for (const d of claimed) {
      try {
        await this.prisma.medicationDose.updateMany({
          where: { ...slotWhere(userId, d), takenAt: null, followUpRemindedAt },
          data: { followUpRemindedAt: null },
        });
      } catch (error) {
        // Sem libertar, a toma fica so sem segundo aviso (nunca a dobrar).
        this.logger.warn(
          `Medicacao: falhou libertar um segundo aviso (${
            error instanceof Error ? error.name : 'erro'
          })`,
        );
      }
    }
  }

  // Medicamentos com lembrete e as doses desse dia que ja contam como
  // tratadas. Uma linha com takenAt e remindedAt a null (marcou e desmarcou
  // antes da hora) NAO cancela o lembrete. As linhas ja avisadas servem
  // tambem para escolher o segundo aviso (findFollowUpDoses).
  private findReminderCandidates(date: Date) {
    return this.prisma.medication.findMany({
      where: {
        active: true,
        remindersEnabled: true,
        schedule: MedicationSchedule.DAILY,
        // Sem dispositivo com push nunca ha aviso: sem isto o mesmo user era
        // revisto (e o claim feito e desfeito) a cada minuto.
        user: {
          status: { not: UserStatus.BANNED },
          pushSubscriptions: { some: {} },
        },
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
          select: {
            slotMinutes: true,
            takenAt: true,
            remindedAt: true,
            followUpRemindedAt: true,
          },
        },
      },
    });
  }

  /**
   * Marca uma toma como avisada so se ainda ninguem a tratou. Atomico na BD:
   * - linha de um "desmarcar" (takenAt e remindedAt a null): updateMany
   *   condicional; o remindedAt tem de ficar gravado, senao o mesmo lembrete
   *   repetia-se a cada execucao durante a janela;
   * - sem linha: create; se outra execucao a criou primeiro (ou o user marcou
   *   a toma entretanto), o unique [medicationId, date, slotMinutes] da P2002
   *   e esta execucao nao avisa.
   * Uma toma ja tomada (takenAt) nunca e reclamada.
   */
  private async claimSlot(
    userId: string,
    d: DatedDueDose,
    remindedAt: Date,
  ): Promise<ClaimKind | null> {
    const slot = {
      userId,
      medicationId: d.medicationId,
      date: d.date,
      slotMinutes: d.slotMinutes,
    };
    const { count } = await this.prisma.medicationDose.updateMany({
      where: { ...slot, takenAt: null, remindedAt: null },
      data: { remindedAt },
    });
    if (count > 0) return 'updated';
    try {
      await this.prisma.medicationDose.create({
        data: { ...slot, remindedAt },
      });
      return 'created';
    } catch (error) {
      if (isUniqueViolation(error)) return null;
      throw error;
    }
  }

  // Desfaz so o claim desta execucao (mesmo remindedAt e ainda por tomar):
  // a linha criada e apagada, a de um "desmarcar" volta a remindedAt null.
  private async releaseClaims(
    userId: string,
    claimed: ClaimedDose[],
    remindedAt: Date,
  ) {
    for (const d of claimed) {
      const where = {
        userId,
        medicationId: d.medicationId,
        date: d.date,
        slotMinutes: d.slotMinutes,
        takenAt: null,
        remindedAt,
      };
      try {
        if (d.how === 'created') {
          await this.prisma.medicationDose.deleteMany({ where });
        } else {
          await this.prisma.medicationDose.updateMany({
            where,
            data: { remindedAt: null },
          });
        }
      } catch (error) {
        // Sem libertar, a toma fica so por avisar (nunca a dobrar).
        this.logger.warn(
          `Medicacao: falhou libertar um claim (${
            error instanceof Error ? error.name : 'erro'
          })`,
        );
      }
    }
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      `Medication not found or you don't have access.`,
    );
  }
}
