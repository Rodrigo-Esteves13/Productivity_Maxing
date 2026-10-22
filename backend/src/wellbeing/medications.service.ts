import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from '../push/push.service';
import { getLisbonNow, parseDateKey } from '../common/date-key.util';
import {
  CreateMedicationDto,
  MedicationDoseDto,
  UpdateMedicationDto,
} from './dto/medication.dto';
import {
  MAX_MEDICATIONS_PER_USER,
  MEDICATION_PATH,
  MEDICATION_REMINDER_WINDOW_MINUTES,
} from './wellbeing.constants';

const MEDICATION_SELECT = {
  id: true,
  name: true,
  dosage: true,
  times: true,
  remindersEnabled: true,
  active: true,
} as const;

export interface MedicationView {
  id: string;
  name: string;
  dosage: string | null;
  times: number[];
  remindersEnabled: boolean;
  active: boolean;
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

// Horas sem repetidos e por ordem: o mesmo minuto duas vezes seria a
// mesma toma (e o unique da dose nao deixaria marcar as duas).
function normalizeTimes(times: number[]): number[] {
  return [...new Set(times)].sort((a, b) => a - b);
}

// Tomas de hoje a avisar agora: a hora ja passou, ha menos de
// MEDICATION_REMINDER_WINDOW_MINUTES, e ainda nao ha dose (avisada ou tomada).
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
    const count = await this.prisma.medication.count({ where: { userId } });
    if (count >= MAX_MEDICATIONS_PER_USER) {
      throw new BadRequestException(
        `You can store at most ${MAX_MEDICATIONS_PER_USER} medications.`,
      );
    }
    return this.prisma.medication.create({
      data: {
        userId,
        name: dto.name.trim(),
        dosage: dto.dosage?.trim() || null,
        times: normalizeTimes(dto.times),
        remindersEnabled: dto.remindersEnabled ?? true,
      },
      select: MEDICATION_SELECT,
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMedicationDto,
  ): Promise<MedicationView> {
    const { count } = await this.prisma.medication.updateMany({
      where: { id, userId },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.dosage !== undefined && { dosage: dto.dosage.trim() || null }),
        ...(dto.times !== undefined && { times: normalizeTimes(dto.times) }),
        ...(dto.remindersEnabled !== undefined && {
          remindersEnabled: dto.remindersEnabled,
        }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
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
        where: { userId, active: true },
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
    const medications = await this.prisma.medication.findMany({
      where: {
        active: true,
        remindersEnabled: true,
        user: { status: { not: UserStatus.BANNED } },
      },
      select: {
        id: true,
        userId: true,
        name: true,
        times: true,
        doses: { where: { date: today }, select: { slotMinutes: true } },
      },
    });

    const dueByUser = new Map<string, DueDose[]>();
    for (const m of medications) {
      const due = findDueDoses([m], nowMinutes);
      if (due.length === 0) continue;
      dueByUser.set(m.userId, [...(dueByUser.get(m.userId) ?? []), ...due]);
    }

    let usersPushed = 0;
    for (const [userId, due] of dueByUser) {
      const names = [...new Set(due.map((d) => d.name))];
      const delivered = await this.pushService.notifyUser(
        userId,
        names.length === 1 ? 'medicationDue' : 'medicationsDue',
        { title: names[0], count: names.length - 1, url: MEDICATION_PATH },
      );
      // Sem dispositivo com push: nao marca, tenta na proxima execucao.
      if (delivered === 0) continue;
      usersPushed += 1;
      await this.prisma.medicationDose.createMany({
        data: due.map((d) => ({
          userId,
          medicationId: d.medicationId,
          date: today,
          slotMinutes: d.slotMinutes,
          remindedAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }
    if (usersPushed > 0) {
      this.logger.log(`Medicacao: ${usersPushed} utilizadores avisados`);
    }
    return usersPushed;
  }

  private notFound(): NotFoundException {
    return new NotFoundException(
      `Medication not found or you don't have access.`,
    );
  }
}
