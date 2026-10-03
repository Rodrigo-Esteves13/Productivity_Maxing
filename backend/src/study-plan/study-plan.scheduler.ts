import { MINUTES_PER_DAY } from './study-plan.constants';

// Lógica pura do planeamento: sem Prisma, sem relógio, sem I/O. O
// StudyPlanService trata de carregar dados e passa-os já preparados,
// o que também torna isto testável sem base de dados.

export interface Interval {
  start: number; // minutos desde a meia-noite
  end: number;
}

export interface SchedulerDay {
  key: string; // YYYY-MM-DD, ordem crescente no array
  dayOfWeek: number; // 0=Dom..6=Sáb
  classMinutes: number;
  workMinutes: number;
  freeSlots: Interval[];
}

export interface SchedulerTask {
  taskId: string;
  deadlineKey: string;
  weightPercentage: number | null;
  difficultyRank: number;
  neededMinutes: number;
}

export interface SchedulerConfig {
  dailyLimitMinutes: number;
  overtimeExtraMinutes: number;
  minBlockMinutes: number;
}

export type SlotScorer = (dayOfWeek: number, slot: Interval) => number;

export interface SchedulerBlock {
  date: string;
  startMinutes: number;
  endMinutes: number;
  taskId: string;
  isOvertime: boolean;
}

export interface SchedulerTaskResult {
  plannedMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
}

export interface SchedulerDayResult {
  date: string;
  studyMinutes: number;
  overtimeMinutes: number;
  freeMinutes: number;
}

export interface SchedulerOutput {
  blocks: SchedulerBlock[];
  byTask: Map<string, SchedulerTaskResult>;
  byDay: SchedulerDayResult[];
}

interface DayState {
  day: SchedulerDay;
  slots: Interval[]; // cópias mutáveis: consumidas à medida que se agenda
  usedMinutes: number;
  overtimeMinutes: number;
}

// Duas passagens em vez de um if: primeiro tudo o que cabe no limite
// diário; só depois se abre a margem de overtime para o que sobrou.
const PASS_CAPACITY: ((config: SchedulerConfig) => number)[] = [
  (config) => config.dailyLimitMinutes,
  (config) => config.dailyLimitMinutes + config.overtimeExtraMinutes,
];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals
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

export function complement(busy: Interval[], total: number): Interval[] {
  const free: Interval[] = [];
  let cursor = 0;
  for (const interval of busy) {
    if (interval.start > cursor) {
      free.push({ start: cursor, end: interval.start });
    }
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < total) free.push({ start: cursor, end: total });
  return free;
}

/**
 * Slots livres de um dia. `busy` já traz os buffers de viagem/preparação
 * aplicados a cada lado (aulas e turnos têm buffers diferentes, por isso
 * quem chama é que os expande). As horas de sono suportam virar a
 * meia-noite (ex: 23:00-07:00).
 */
export function buildFreeSlots(
  busy: Interval[],
  quietStart: number | null,
  quietEnd: number | null,
  minMinute: number,
): Interval[] {
  const blocked: Interval[] = [...busy];

  if (quietStart !== null && quietEnd !== null) {
    if (quietStart < quietEnd) {
      blocked.push({ start: quietStart, end: quietEnd });
    } else {
      blocked.push({ start: 0, end: quietEnd });
      blocked.push({ start: quietStart, end: MINUTES_PER_DAY });
    }
  }

  // Nunca sugerir no passado de hoje.
  if (minMinute > 0) blocked.push({ start: 0, end: minMinute });

  return complement(mergeIntervals(blocked), MINUTES_PER_DAY);
}

function compareUrgency(a: SchedulerTask, b: SchedulerTask): number {
  if (a.deadlineKey !== b.deadlineKey) {
    return a.deadlineKey < b.deadlineKey ? -1 : 1;
  }
  const weightDiff = (b.weightPercentage ?? -1) - (a.weightPercentage ?? -1);
  if (weightDiff !== 0) return weightDiff;
  return b.difficultyRank - a.difficultyRank;
}

function sumSlots(slots: Interval[]): number {
  return slots.reduce((sum, s) => sum + Math.max(0, s.end - s.start), 0);
}

export function planStudyBlocks(
  days: SchedulerDay[],
  tasks: SchedulerTask[],
  config: SchedulerConfig,
  scoreSlot: SlotScorer,
): SchedulerOutput {
  const states: DayState[] = days.map((day) => ({
    day,
    slots: day.freeSlots.map((s) => ({ ...s })),
    usedMinutes: 0,
    overtimeMinutes: 0,
  }));

  const sortedTasks = [...tasks].sort(compareUrgency);
  const remaining = new Map(
    sortedTasks.map((t) => [t.taskId, t.neededMinutes]),
  );
  const byTask = new Map<string, SchedulerTaskResult>(
    sortedTasks.map((t) => [
      t.taskId,
      { plannedMinutes: 0, overtimeMinutes: 0, shortfallMinutes: 0 },
    ]),
  );
  const blocks: SchedulerBlock[] = [];
  const firstKey = days[0]?.key ?? '';

  for (const capacityFor of PASS_CAPACITY) {
    const capacity = capacityFor(config);

    for (const task of sortedTasks) {
      // Task atrasada continua a precisar de tempo: usa-se hoje.
      const lastUsableKey =
        task.deadlineKey < firstKey ? firstKey : task.deadlineKey;

      for (const state of states) {
        if (state.day.key > lastUsableKey) break;

        // Slots historicamente melhores primeiro (heatmap); empate pelo
        // mais cedo.
        const ranked = [...state.slots].sort(
          (a, b) =>
            scoreSlot(state.day.dayOfWeek, b) -
              scoreSlot(state.day.dayOfWeek, a) || a.start - b.start,
        );

        for (const slot of ranked) {
          const needed = remaining.get(task.taskId) ?? 0;
          if (needed <= 0) break;

          const budget = capacity - state.usedMinutes;
          const available = Math.min(slot.end - slot.start, needed, budget);
          const minBlock = Math.min(config.minBlockMinutes, needed);
          if (available < minBlock) continue;

          const overBefore = Math.max(
            0,
            state.usedMinutes - config.dailyLimitMinutes,
          );
          state.usedMinutes += available;
          const overAdded =
            Math.max(0, state.usedMinutes - config.dailyLimitMinutes) -
            overBefore;

          blocks.push({
            date: state.day.key,
            startMinutes: slot.start,
            endMinutes: slot.start + available,
            taskId: task.taskId,
            isOvertime: overAdded > 0,
          });

          // Consome o slot para a próxima task nunca o sobrepor.
          slot.start += available;
          state.overtimeMinutes += overAdded;
          remaining.set(task.taskId, needed - available);

          const result = byTask.get(task.taskId);
          if (result) {
            result.plannedMinutes += available;
            result.overtimeMinutes += overAdded;
          }
        }
      }
    }
  }

  for (const task of sortedTasks) {
    const result = byTask.get(task.taskId);
    if (result) result.shortfallMinutes = remaining.get(task.taskId) ?? 0;
  }

  blocks.sort((a, b) =>
    a.date === b.date
      ? a.startMinutes - b.startMinutes
      : a.date < b.date
        ? -1
        : 1,
  );

  return {
    blocks,
    byTask,
    byDay: states.map((s) => ({
      date: s.day.key,
      studyMinutes: s.usedMinutes,
      overtimeMinutes: s.overtimeMinutes,
      freeMinutes: sumSlots(s.slots),
    })),
  };
}

export { sumSlots };
