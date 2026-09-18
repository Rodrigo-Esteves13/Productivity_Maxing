import { Injectable } from '@nestjs/common';
import { Difficulty } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import {
  StudySessionsService,
  HOUR_BUCKET_SIZE,
} from '../study-sessions/study-sessions.service';

const MINUTES_PER_DAY = 1440;

// Duração assumida quando a task não tem Task.estimatedMinutes definido
// (campo opcional, preenchido manualmente pelo user - ver comentário em
// Task.estimatedMinutes no schema.prisma). Números redondos, propositada-
// mente conservadores - é sempre melhor sugerir pouco tempo a mais do que
// esmagar o dia inteiro de alguém com uma estimativa exagerada.
const DEFAULT_MINUTES_BY_DIFFICULTY: Record<Difficulty, number> = {
  VERY_EASY: 30,
  EASY: 60,
  MEDIUM: 90,
  HARD: 120,
  VERY_HARD: 180,
};

// Nenhum slot sugerido tem menos do que isto - um bloco de 6 minutos entre
// duas aulas não é uma sessão de estudo útil, é ruído na sugestão.
const MIN_BLOCK_MINUTES = 20;

// Limite de estudo sugerido por dia. Isto é uma escolha de produto
// deliberada, não uma limitação técnica: o algoritmo greedy sozinho
// preencheria alegremente cada minuto livre do dia de alguém com tasks
// atrasadas, o que é exatamente o tipo de sobrecarga que o
// OverloadAlertCard já existe para sinalizar noutro sítio da app. Prefere-
// se distribuir por mais dias (e avisar via `warnings` se mesmo assim não
// chegar) do que gerar um plano de 10h de estudo num único dia.
const MAX_STUDY_MINUTES_PER_DAY = 240;

interface Interval {
  start: number; // minutos desde a meia-noite
  end: number;
}

export interface StudyPlanSuggestion {
  date: string; // YYYY-MM-DD, hora de Lisboa
  startMinutes: number;
  endMinutes: number;
  taskId: string;
  taskTitle: string;
}

export interface StudyPlanResult {
  suggestions: StudyPlanSuggestion[];
  warnings: string[];
}

@Injectable()
export class StudyPlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService,
    private readonly studySessionsService: StudySessionsService,
  ) {}

  async generate(userId: string, days: number): Promise<StudyPlanResult> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { commuteMinutes: true, quietHoursStart: true, quietHoursEnd: true },
    });

    const { today, nowMinutes } = this.getLisbonNow();
    const rangeEnd = addDays(today, days - 1);

    const [occurrences, heatmap, tasks] = await Promise.all([
      this.scheduleService.findRange(userId, today, rangeEnd),
      this.studySessionsService.getHeatmap(userId),
      // Tasks pendentes com prazo dentro da janela do plano (ou já
      // atrasadas - date < today também entra, mesma regra do
      // TasksService.findToday: uma task atrasada e não concluída
      // continua a precisar de tempo de estudo, mais ainda). Períodos
      // arquivados nunca geram sugestões, mesma regra do resto da app.
      this.prisma.task.findMany({
        where: {
          userId,
          progressStatus: { not: 'COMPLETED' },
          date: { lte: rangeEnd },
          period: { isArchived: false },
        },
        select: {
          id: true,
          title: true,
          date: true,
          difficulty: true,
          weightPercentage: true,
          estimatedMinutes: true,
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // dayOfWeek (0=Dom..6=Sáb) x hourBucket -> totalMinutes, para
    // preferir os slots livres nas horas onde o user historicamente
    // estuda mais/melhor.
    const heatmapScore = new Map<string, number>();
    for (const cell of heatmap) {
      heatmapScore.set(`${cell.dayOfWeek}:${cell.hourBucket}`, cell.totalMinutes);
    }

    // Constrói o mapa de slots livres por dia, já sem aulas+viagem nem
    // horas de sono - ver buildFreeSlotsForDay().
    const freeByDay = new Map<string, Interval[]>();
    for (let i = 0; i < days; i++) {
      const day = addDays(today, i);
      const key = dateKey(day);
      const dayOccurrences = occurrences.filter(
        (o) => dateKey(o.date) === key,
      );
      const minMinute = i === 0 ? nowMinutes : 0; // nunca sugerir no passado de hoje
      freeByDay.set(
        key,
        this.buildFreeSlotsForDay(
          dayOccurrences,
          user.commuteMinutes,
          user.quietHoursStart,
          user.quietHoursEnd,
          minMinute,
        ),
      );
    }

    const usedMinutesByDay = new Map<string, number>();
    const suggestions: StudyPlanSuggestion[] = [];
    const warnings: string[] = [];

    // Urgência: prazo mais próximo primeiro; a igualdade de prazo desempata
    // por peso na nota (maior primeiro) e depois por dificuldade (maior
    // primeiro) - mesmo critério que TasksService.findToday já usa para o
    // "Today's plan" no Focus, só que aqui espalhado por vários dias.
    const sortedTasks = [...tasks].sort((a, b) => {
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      const weightDiff = (b.weightPercentage ?? -1) - (a.weightPercentage ?? -1);
      if (weightDiff !== 0) return weightDiff;
      return DIFFICULTY_ORDER[b.difficulty] - DIFFICULTY_ORDER[a.difficulty];
    });

    for (const task of sortedTasks) {
      let remaining =
        task.estimatedMinutes ?? DEFAULT_MINUTES_BY_DIFFICULTY[task.difficulty];

      const deadlineKey = dateKey(task.date);
      const lastUsableDay =
        deadlineKey < dateKey(today) ? today : minDate(task.date, rangeEnd);

      for (
        let day = today;
        day <= lastUsableDay && remaining > 0;
        day = addDays(day, 1)
      ) {
        const key = dateKey(day);
        const freeSlots = freeByDay.get(key);
        if (!freeSlots || freeSlots.length === 0) continue;

        const usedToday = usedMinutesByDay.get(key) ?? 0;
        let dailyBudget = MAX_STUDY_MINUTES_PER_DAY - usedToday;
        if (dailyBudget < MIN_BLOCK_MINUTES) continue;

        // Dentro do dia, tenta primeiro os slots historicamente melhores
        // (heatmap), não só os mais cedo - a ordem entre dias já garante
        // que dias mais próximos do prazo são preenchidos primeiro.
        const dayOfWeek = day.getUTCDay();
        const ranked = [...freeSlots].sort(
          (a, b) =>
            this.scoreSlot(dayOfWeek, b, heatmapScore) -
            this.scoreSlot(dayOfWeek, a, heatmapScore),
        );

        for (const slot of ranked) {
          if (remaining <= 0 || dailyBudget < MIN_BLOCK_MINUTES) break;

          const available = Math.min(
            slot.end - slot.start,
            remaining,
            dailyBudget,
          );
          if (available < MIN_BLOCK_MINUTES) continue;

          const blockStart = slot.start;
          const blockEnd = slot.start + available;

          suggestions.push({
            date: key,
            startMinutes: blockStart,
            endMinutes: blockEnd,
            taskId: task.id,
            taskTitle: task.title,
          });

          // Consome o slot (in-place, dentro do próprio array partilhado
          // por freeByDay) para que a próxima task nunca sobreponha este
          // bloco.
          slot.start = blockEnd;
          remaining -= available;
          dailyBudget -= available;
          usedMinutesByDay.set(key, (usedMinutesByDay.get(key) ?? 0) + available);
        }
      }

      if (remaining > 0) {
        warnings.push(
          `Not enough free time before the deadline for "${task.title}" - ${remaining} minute(s) still unscheduled.`,
        );
      }
    }

    suggestions.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return a.startMinutes - b.startMinutes;
    });

    return { suggestions, warnings };
  }

  /**
   * Slots livres de um dia (minutos 0-1440), já sem: horas de sono
   * (quietHours, com suporte a virar a meia-noite) e blocos de
   * aulas+viagem (cada ClassOccurrence expandida por commuteMinutes dos
   * dois lados, depois todos os blocos sobrepostos/adjacentes fundidos -
   * é assim que duas aulas seguidas só levam UM buffer de viagem entre
   * elas, não dois).
   */
  private buildFreeSlotsForDay(
    dayOccurrences: { startMinutes: number; endMinutes: number }[],
    commuteMinutes: number | null,
    quietHoursStart: number | null,
    quietHoursEnd: number | null,
    minMinute: number,
  ): Interval[] {
    const busy: Interval[] = [];

    const buffer = commuteMinutes ?? 0;
    for (const occ of dayOccurrences) {
      busy.push({
        start: clamp(occ.startMinutes - buffer, 0, MINUTES_PER_DAY),
        end: clamp(occ.endMinutes + buffer, 0, MINUTES_PER_DAY),
      });
    }

    if (quietHoursStart != null && quietHoursEnd != null) {
      if (quietHoursStart < quietHoursEnd) {
        busy.push({ start: quietHoursStart, end: quietHoursEnd });
      } else {
        // Vira a meia-noite (ex: dorme 23:00-07:00): a manhã deste dia
        // (0 -> quietHoursEnd) é a continuação da noite anterior, e a
        // noite deste dia (quietHoursStart -> fim do dia) é o início da
        // próxima. Ambas contam como indisponíveis NESTE dia.
        busy.push({ start: 0, end: quietHoursEnd });
        busy.push({ start: quietHoursStart, end: MINUTES_PER_DAY });
      }
    }

    if (minMinute > 0) {
      busy.push({ start: 0, end: minMinute });
    }

    return complement(mergeIntervals(busy), MINUTES_PER_DAY);
  }

  // NOTA: StudySessionsService.getHeatmap() deriva dayOfWeek/hourBucket de
  // `session.startedAt.getDay()`/`.getHours()`, que usam o fuso horário do
  // PROCESSO (Render corre em UTC), não explicitamente Europe/Lisbon - por
  // isso aqui usamos day.getUTCDay() (não getLisbonNow() outra vez) para
  // ficar consistente com o mesmo sistema de coordenadas que o heatmap já
  // usa, em vez de comparar dois relógios diferentes. Isto significa que,
  // tal como o heatmap, este score fica ~1h desalinhado da hora real de
  // Lisboa durante o horário de verão - pré-existente, não introduzido
  // aqui, e sem grande impacto (é só um desempate entre slots, não um
  // limite rígido).
  private scoreSlot(
    dayOfWeek: number,
    slot: Interval,
    heatmapScore: Map<string, number>,
  ): number {
    const midpoint = Math.floor((slot.start + slot.end) / 2);
    const bucket = Math.floor(midpoint / 60 / HOUR_BUCKET_SIZE);
    return heatmapScore.get(`${dayOfWeek}:${bucket}`) ?? 0;
  }

  /**
   * "Agora" em hora de Lisboa: a data de hoje à meia-noite (UTC, usada
   * como chave de dia em todo o serviço) e os minutos já passados do dia
   * de hoje. Calculado via Intl em vez de new Date().getHours() porque o
   * processo do backend corre em UTC no Render - getHours() daria a hora
   * errada em metade do ano (mudança de horário de verão).
   */
  private getLisbonNow(): { today: Date; nowMinutes: number } {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Lisbon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    const today = new Date(
      Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))),
    );
    const nowMinutes = Number(get('hour')) * 60 + Number(get('minute'));
    return { today, nowMinutes };
  }
}

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  VERY_EASY: 0,
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
  VERY_HARD: 4,
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, n: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

function complement(busy: Interval[], totalMinutes: number): Interval[] {
  const free: Interval[] = [];
  let cursor = 0;
  for (const interval of busy) {
    if (interval.start > cursor) {
      free.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < totalMinutes) {
    free.push({ start: cursor, end: totalMinutes });
  }
  return free;
}
