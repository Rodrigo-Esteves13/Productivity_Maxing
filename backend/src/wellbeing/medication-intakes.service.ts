import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import {
  diffUtcDays,
  lisbonDayBounds,
  parseDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import { MS_PER_DAY, MS_PER_MINUTE } from '../common/time.constants';
import {
  CreateMedicationIntakeDto,
  MedicationIntakeRangeQueryDto,
} from './dto/medication.dto';
import {
  MAX_INTAKE_FUTURE_MINUTES,
  MAX_INTAKE_PAST_DAYS,
  MAX_INTAKE_RANGE_DAYS,
  MAX_INTAKES_PER_DAY,
} from './wellbeing.constants';

const INTAKE_SELECT = {
  id: true,
  medicationId: true,
  takenAt: true,
  dose: true,
  note: true,
  medication: { select: { name: true } },
} as const;

export interface MedicationIntakeView {
  id: string;
  medicationId: string;
  name: string;
  takenAt: Date;
  dose: string | null;
  note: string | null;
}

type IntakeRow = {
  id: string;
  medicationId: string;
  takenAt: Date;
  dose: string | null;
  note: string | null;
  medication: { name: string };
};

const toView = (row: IntakeRow): MedicationIntakeView => ({
  id: row.id,
  medicationId: row.medicationId,
  name: row.medication.name,
  takenAt: row.takenAt,
  dose: row.dose,
  note: row.note,
});

// Registo de tomas avulso: "se necessario" ou doses extra de qualquer
// medicamento. Varias tomas do mesmo medicamento, ate na mesma hora exata,
// sao validas (sem unique no modelo). So guarda o que o utilizador registou:
// nao avalia doses, combinacoes nem dependencia (de proposito, para a app
// nunca dizer se algo e seguro).
@Injectable()
export class MedicationIntakesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly disclaimer: MedicationDisclaimerService,
  ) {}

  async list(
    userId: string,
    query: MedicationIntakeRangeQueryDto,
  ): Promise<MedicationIntakeView[]> {
    const span = diffUtcDays(parseDateKey(query.from), parseDateKey(query.to));
    if (span < 0 || span >= MAX_INTAKE_RANGE_DAYS) {
      throw new BadRequestException(
        `The range must be between 1 and ${MAX_INTAKE_RANGE_DAYS} days.`,
      );
    }
    const rows = await this.prisma.medicationIntake.findMany({
      where: {
        userId,
        takenAt: {
          gte: lisbonDayBounds(query.from).start,
          lt: lisbonDayBounds(query.to).end,
        },
      },
      select: INTAKE_SELECT,
      orderBy: { takenAt: 'desc' },
    });
    return rows.map(toView);
  }

  async create(
    userId: string,
    dto: CreateMedicationIntakeDto,
  ): Promise<MedicationIntakeView> {
    await this.disclaimer.assertAccepted(userId);
    const takenAt = this.parseTakenAt(dto.takenAt);

    const medication = await this.prisma.medication.findFirst({
      where: { id: dto.medicationId, userId },
      select: { id: true },
    });
    if (!medication) {
      throw new NotFoundException(
        `Medication not found or you don't have access.`,
      );
    }

    const { start, end } = lisbonDayBounds(toLisbonDateKey(takenAt));
    // Contar e criar na mesma transacao, com um lock por utilizador: dois
    // pedidos em simultaneo nao passam do limite diario.
    const row = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const sameDay = await tx.medicationIntake.count({
        where: { userId, takenAt: { gte: start, lt: end } },
      });
      if (sameDay >= MAX_INTAKES_PER_DAY) {
        throw new BadRequestException(
          `You can log at most ${MAX_INTAKES_PER_DAY} entries per day.`,
        );
      }
      return tx.medicationIntake.create({
        data: {
          userId,
          medicationId: dto.medicationId,
          takenAt,
          dose: dto.dose?.trim() || null,
          note: dto.note?.trim() || null,
        },
        select: INTAKE_SELECT,
      });
    });
    return toView(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    const { count } = await this.prisma.medicationIntake.deleteMany({
      where: { id, userId },
    });
    if (count === 0) {
      throw new NotFoundException(`Entry not found or you don't have access.`);
    }
  }

  private parseTakenAt(value: string): Date {
    const takenAt = new Date(value);
    const now = Date.now();
    const tooNew =
      takenAt.getTime() > now + MAX_INTAKE_FUTURE_MINUTES * MS_PER_MINUTE;
    const tooOld = takenAt.getTime() < now - MAX_INTAKE_PAST_DAYS * MS_PER_DAY;
    if (Number.isNaN(takenAt.getTime()) || tooNew || tooOld) {
      throw new BadRequestException(
        `The time must be in the last ${MAX_INTAKE_PAST_DAYS} days and not in the future.`,
      );
    }
    return takenAt;
  }
}
