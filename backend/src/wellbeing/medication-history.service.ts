import { BadRequestException, Injectable } from '@nestjs/common';
import { MedicationSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  addUtcDays,
  diffUtcDays,
  getLisbonNow,
  lisbonDayBounds,
  parseDateKey,
  toDateKey,
  toLisbonDateKey,
} from '../common/date-key.util';
import { MAX_MEDICATION_HISTORY_DAYS } from './wellbeing.constants';

export interface MedicationHistoryDay {
  date: string;
  scheduled: number;
  taken: number;
}

export interface MedicationHistoryItem {
  id: string;
  name: string;
  schedule: MedicationSchedule;
  scheduled: number;
  taken: number;
  asNeeded: number;
}

export interface MedicationHistory {
  from: string;
  to: string;
  days: MedicationHistoryDay[];
  medications: MedicationHistoryItem[];
  totals: { scheduled: number; taken: number; asNeeded: number };
}

interface HistoryMedication {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  active: boolean;
  schedule: MedicationSchedule;
  times: number[];
}

/**
 * Quantas tomas estavam marcadas nesse dia: so diarios, a partir do dia em
 * que o medicamento foi criado e, se ja nao esta ativo, ate ao dia em que
 * foi desativado. Os horarios contam como os atuais (nao ha historico de
 * mudancas de horario).
 */
export function scheduledSlotsOn(
  m: HistoryMedication,
  dateKey: string,
): number {
  if (m.schedule !== MedicationSchedule.DAILY) return 0;
  if (dateKey < toLisbonDateKey(m.createdAt)) return 0;
  if (!m.active && dateKey > toLisbonDateKey(m.updatedAt)) return 0;
  return m.times.length;
}

// Resumo de adesao (tomas marcadas vs tomadas) e das tomas "se necessario"
// num intervalo. So conta, nunca avalia se algo esta certo.
@Injectable()
export class MedicationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async get(
    userId: string,
    fromKey: string,
    toKey: string,
  ): Promise<MedicationHistory> {
    const from = parseDateKey(fromKey);
    const requestedTo = parseDateKey(toKey);
    const span = diffUtcDays(from, requestedTo);
    if (span < 0 || span >= MAX_MEDICATION_HISTORY_DAYS) {
      throw new BadRequestException(
        `The range must be between 1 and ${MAX_MEDICATION_HISTORY_DAYS} days.`,
      );
    }
    // Dias futuros ainda nao contam como falhados.
    const { today } = getLisbonNow();
    const to = requestedTo > today ? today : requestedTo;
    const dayKeys: string[] = [];
    for (let d = from; d <= to; d = addUtcDays(d, 1))
      dayKeys.push(toDateKey(d));

    const [medications, doses, intakes] = await Promise.all([
      this.prisma.medication.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          active: true,
          schedule: true,
          times: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.medicationDose.findMany({
        where: {
          userId,
          takenAt: { not: null },
          date: { gte: from, lte: to },
        },
        select: { medicationId: true, date: true },
      }),
      // Intervalo todo no futuro: fica so o dia `from`, ainda sem tomas.
      this.prisma.medicationIntake.groupBy({
        by: ['medicationId'],
        where: {
          userId,
          takenAt: {
            gte: lisbonDayBounds(fromKey).start,
            lt: lisbonDayBounds(toDateKey(to < from ? from : to)).end,
          },
        },
        _count: { _all: true },
      }),
    ]);

    // Tomas marcadas por medicamento e dia.
    const marked = new Map<string, number>();
    for (const dose of doses) {
      const key = `${dose.medicationId}|${toDateKey(dose.date)}`;
      marked.set(key, (marked.get(key) ?? 0) + 1);
    }
    // Nunca mais tomadas do que planeadas nesse dia: depois de mudar o
    // horario, uma toma marcada no horario antigo contava a mais e escondia
    // um dia falhado.
    const takenOn = (m: HistoryMedication, date: string) =>
      Math.min(marked.get(`${m.id}|${date}`) ?? 0, scheduledSlotsOn(m, date));
    const asNeededByMedication = new Map(
      intakes.map((row) => [row.medicationId, row._count._all]),
    );

    const days = dayKeys.map((date) => ({
      date,
      scheduled: medications.reduce(
        (sum, m) => sum + scheduledSlotsOn(m, date),
        0,
      ),
      taken: medications.reduce((sum, m) => sum + takenOn(m, date), 0),
    }));

    const items = medications
      .map((m) => ({
        id: m.id,
        name: m.name,
        schedule: m.schedule,
        scheduled: dayKeys.reduce(
          (sum, date) => sum + scheduledSlotsOn(m, date),
          0,
        ),
        taken: dayKeys.reduce((sum, date) => sum + takenOn(m, date), 0),
        asNeeded: asNeededByMedication.get(m.id) ?? 0,
      }))
      .filter((item) => item.scheduled + item.taken + item.asNeeded > 0);

    return {
      from: fromKey,
      to: toDateKey(to),
      days,
      medications: items,
      totals: {
        scheduled: days.reduce((sum, d) => sum + d.scheduled, 0),
        taken: days.reduce((sum, d) => sum + d.taken, 0),
        asNeeded: items.reduce((sum, i) => sum + i.asNeeded, 0),
      },
    };
  }
}
