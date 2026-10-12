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
  areaId: string;
  deadlineKey: string;
  weightPercentage: number | null;
  difficultyRank: number;
  neededMinutes: number;
  // Teste/exame/apresentação: a data é o evento, por isso o último dia de
  // estudo é o anterior (estudar NO dia do exame não conta).
  isEvent: boolean;
}

// Cadeira "ativa" que merece estudo de consolidação mesmo sem prazo à
// vista (ver planReviewBlocks).
export interface ReviewCourse {
  areaId: string;
  // Há uma avaliação (com peso ou evento) nas próximas semanas.
  hasNearGradedDeadline: boolean;
  // Dias desde a última vez que estudaste esta cadeira (null = sem registo
  // recente). Conta sessões e blocos de tasks da cadeira.
  daysSinceStudied: number | null;
}

export interface SchedulerConfig {
  dailyLimitMinutes: number;
  overtimeExtraMinutes: number;
  minBlockMinutes: number;
  // Estudo de consolidação (revisão leve) para cadeiras ativas.
  reviewBlockMinutes?: number;
  reviewBlockMinutesNearDeadline?: number;
  reviewMaxPerDay?: number;
  reviewDailyCapMinutes?: number;
}

export type SlotScorer = (dayOfWeek: number, slot: Interval) => number;

export interface SchedulerBlock {
  date: string;
  startMinutes: number;
  endMinutes: number;
  // null nos blocos de revisão (kind 'review'): pertencem a uma cadeira.
  taskId: string | null;
  areaId: string;
  kind: 'task' | 'review';
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
  // Parte de studyMinutes que é revisão de consolidação.
  reviewMinutes: number;
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
  reviewMinutes: number;
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

// 1 = o último dia pesa o dobro do primeiro.
const DEADLINE_RAMP = 1;

const MS_PER_DAY = 86_400_000;

function dayDiff(laterKey: string, earlierKey: string): number {
  return Math.round(
    (Date.parse(laterKey) - Date.parse(earlierKey)) / MS_PER_DAY,
  );
}

function shiftKey(key: string, days: number): string {
  return new Date(Date.parse(key) + days * MS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

// Estado partilhado pelos passos do planeamento.
interface PlanContext {
  states: DayState[];
  config: SchedulerConfig;
  scoreSlot: SlotScorer;
  blocks: SchedulerBlock[];
}

/**
 * Coloca até `target` minutos num dia, nos melhores slots livres (heatmap
 * primeiro, empate pelo mais cedo), sem passar de `capacity` minutos de
 * estudo nesse dia. Devolve quanto foi mesmo colocado. Cada bloco consome o
 * slot para nada o sobrepor.
 */
function placeMinutes(
  ctx: PlanContext,
  state: DayState,
  target: number,
  capacity: number,
  meta: { taskId: string | null; areaId: string; kind: 'task' | 'review' },
  minBlock: number,
): { placed: number; overtime: number } {
  let placed = 0;
  let overtime = 0;

  const ranked = [...state.slots].sort(
    (a, b) =>
      ctx.scoreSlot(state.day.dayOfWeek, b) -
        ctx.scoreSlot(state.day.dayOfWeek, a) || a.start - b.start,
  );

  for (const slot of ranked) {
    const stillNeeded = target - placed;
    if (stillNeeded <= 0) break;

    const budget = capacity - state.usedMinutes;
    const available = Math.min(slot.end - slot.start, stillNeeded, budget);
    if (available < Math.min(minBlock, stillNeeded)) continue;

    const overBefore = Math.max(
      0,
      state.usedMinutes - ctx.config.dailyLimitMinutes,
    );
    state.usedMinutes += available;
    const overAdded =
      Math.max(0, state.usedMinutes - ctx.config.dailyLimitMinutes) -
      overBefore;

    ctx.blocks.push({
      date: state.day.key,
      startMinutes: slot.start,
      endMinutes: slot.start + available,
      taskId: meta.taskId,
      areaId: meta.areaId,
      kind: meta.kind,
      isOvertime: overAdded > 0,
    });

    slot.start += available;
    state.overtimeMinutes += overAdded;
    if (meta.kind === 'review') state.reviewMinutes += available;
    placed += available;
    overtime += overAdded;
  }
  return { placed, overtime };
}

/**
 * Planeamento em 4 passos (tudo sobre o horizonte `days`, tipicamente 4
 * semanas; prazos mais longe também entram no ritmo):
 *
 * 1. RITMO - cada task reparte o que falta pelos dias até ao prazo, mais nos
 *    dias com mais tempo livre e menos nos carregados, em vez de gastar tudo
 *    logo ou só no fim. Estudar pouco e várias vezes consolida melhor do que
 *    uma maratona, e mantém o ritmo mesmo quando o prazo ainda está longe.
 *    Fatias pequenas demais viram uma sessão a cada poucos dias (espaçamento).
 * 2. RECUPERAÇÃO - o que o ritmo não conseguiu (dias cheios) preenche os
 *    primeiros dias livres, dentro do limite diário.
 * 3. OVERTIME - o resto, acima do limite diário, marcado como overtime.
 * 4. CONSOLIDAÇÃO - cadeiras ativas sem estudo recente ganham sessões leves
 *    de revisão nos dias com folga, mesmo sem prazos próximos.
 *
 * Tasks cujo prazo cai depois do horizonte só entram no ritmo (passo 1); não
 * são recuperadas nem contam como falta de tempo.
 */
export function planStudyBlocks(
  days: SchedulerDay[],
  tasks: SchedulerTask[],
  config: SchedulerConfig,
  scoreSlot: SlotScorer,
  reviewCourses: ReviewCourse[] = [],
): SchedulerOutput {
  const states: DayState[] = days.map((day) => ({
    day,
    slots: day.freeSlots.map((s) => ({ ...s })),
    usedMinutes: 0,
    overtimeMinutes: 0,
    reviewMinutes: 0,
  }));
  const blocks: SchedulerBlock[] = [];
  const ctx: PlanContext = { states, config, scoreSlot, blocks };

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

  const firstKey = days[0]?.key ?? '';
  const lastKey = days[days.length - 1]?.key ?? '';

  // Último dia de estudo de cada task (índice na lista de dias; pode ficar
  // para além do horizonte) e se cai fora do horizonte.
  const lastUsableKey = new Map<string, string>();
  const lastUsableIndex = new Map<string, number>();
  const beyondHorizon = new Set<string>();
  for (const task of sortedTasks) {
    let key = task.deadlineKey;
    if (task.isEvent && key > firstKey) key = shiftKey(key, -1);
    // Task atrasada continua a precisar de tempo: usa-se hoje.
    if (key < firstKey) key = firstKey;
    lastUsableKey.set(task.taskId, key);
    lastUsableIndex.set(task.taskId, dayDiff(key, firstKey));
    if (key > lastKey) beyondHorizon.add(task.taskId);
  }

  // Capacidade diária "normal" (sem overtime) de cada dia, e a média, usada
  // para os dias para além do horizonte que ainda não se conhecem.
  const dailyCapacity = days.map((d) =>
    Math.min(sumSlots(d.freeSlots), config.dailyLimitMinutes),
  );
  const averageCapacity = Math.max(
    60,
    dailyCapacity.length > 0
      ? dailyCapacity.reduce((a, b) => a + b, 0) / dailyCapacity.length
      : 0,
  );

  // Peso de estudo do dia j para uma task com último dia `lastIndex`: a
  // capacidade do dia, com um aumento gradual até ao prazo (quem estuda de
  // forma saudável aperta o ritmo perto da avaliação, o último dia pesa o
  // dobro do primeiro). Dias fora do horizonte contam com a capacidade média.
  const dayWeight = (j: number, lastIndex: number): number => {
    const capacity = j < dailyCapacity.length ? dailyCapacity[j] : averageCapacity;
    const progress = lastIndex <= 0 ? 1 : j / lastIndex;
    return capacity * (1 + DEADLINE_RAMP * progress);
  };
  const weightUntil = (fromIndex: number, lastIndex: number): number => {
    let total = 0;
    for (let j = fromIndex; j <= lastIndex; j++) total += dayWeight(j, lastIndex);
    return total;
  };

  const record = (taskId: string, placed: number, overtime: number) => {
    remaining.set(taskId, (remaining.get(taskId) ?? 0) - placed);
    const result = byTask.get(taskId);
    if (result) {
      result.plannedMinutes += placed;
      result.overtimeMinutes += overtime;
    }
  };

  // ---- 1. RITMO ---------------------------------------------------------
  const lastPlacedIndex = new Map<string, number>();
  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    for (const task of sortedTasks) {
      const lastIndex = lastUsableIndex.get(task.taskId) ?? 0;
      if (i > lastIndex) continue;
      const needed = remaining.get(task.taskId) ?? 0;
      if (needed <= 0) continue;

      let target: number;
      if (i === lastIndex) {
        target = needed; // último dia: o que falta
      } else {
        const totalWeight = weightUntil(i, lastIndex);
        const share = totalWeight > 0 ? dayWeight(i, lastIndex) / totalWeight : 0;
        target = Math.ceil(needed * share);
      }
      if (target <= 0) continue;

      // Fatia pequena demais para uma sessão: espaça (uma sessão de bloco
      // mínimo a cada poucos dias, em vez de migalhas todos os dias).
      if (target < config.minBlockMinutes && needed > target) {
        const gap = Math.min(7, Math.ceil(config.minBlockMinutes / target));
        const last = lastPlacedIndex.get(task.taskId);
        if (last !== undefined && i - last < gap) continue;
        target = Math.min(needed, config.minBlockMinutes);
      }
      target = Math.min(target, needed);

      const { placed } = placeMinutes(
        ctx,
        state,
        target,
        config.dailyLimitMinutes,
        { taskId: task.taskId, areaId: task.areaId, kind: 'task' },
        config.minBlockMinutes,
      );
      if (placed > 0) {
        lastPlacedIndex.set(task.taskId, i);
        record(task.taskId, placed, 0);
      }
    }
  }

  // ---- 2. RECUPERAÇÃO e 3. OVERTIME ------------------------------------
  for (const capacityFor of PASS_CAPACITY) {
    const capacity = capacityFor(config);

    for (const task of sortedTasks) {
      // Prazos para lá do horizonte só seguem o ritmo.
      if (beyondHorizon.has(task.taskId)) continue;
      const lastUsable = lastUsableKey.get(task.taskId) ?? firstKey;

      for (const state of states) {
        if (state.day.key > lastUsable) break;
        const needed = remaining.get(task.taskId) ?? 0;
        if (needed <= 0) break;

        const { placed, overtime } = placeMinutes(
          ctx,
          state,
          needed,
          capacity,
          { taskId: task.taskId, areaId: task.areaId, kind: 'task' },
          config.minBlockMinutes,
        );
        if (placed > 0) record(task.taskId, placed, overtime);
      }
    }
  }

  // ---- 4. CONSOLIDAÇÃO --------------------------------------------------
  planReviewBlocks(ctx, tasks, reviewCourses);

  for (const task of sortedTasks) {
    const result = byTask.get(task.taskId);
    if (!result) continue;
    // Para lá do horizonte não há "falta": ainda há dias para estudar.
    result.shortfallMinutes = beyondHorizon.has(task.taskId)
      ? 0
      : Math.max(0, remaining.get(task.taskId) ?? 0);
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
      reviewMinutes: s.reviewMinutes,
      overtimeMinutes: s.overtimeMinutes,
      freeMinutes: sumSlots(s.slots),
    })),
  };
}

const DEFAULT_REVIEW_MINUTES = 30;
const DEFAULT_REVIEW_MINUTES_NEAR = 45;
const DEFAULT_REVIEW_MAX_PER_DAY = 2;
const DEFAULT_REVIEW_DAILY_CAP = 90;
// Dias sem tocar na cadeira antes de sugerir nova revisão: mais seguido
// quando há avaliação à vista (~3x/semana), senão ~2x/semana.
const REVIEW_GAP_DAYS_NEAR = 2;
const REVIEW_GAP_DAYS = 3;
// Revisões só usam o tempo que sobra: nunca empurram o dia para overtime e
// deixam sempre esta folga livre.
const REVIEW_KEEP_FREE_MINUTES = 30;

/**
 * Consolidação: uma cadeira que não estudas há uns dias esquece-se, tenhas ou
 * não um prazo próximo. Para cada cadeira ativa, sugere uma sessão leve
 * quando já passaram dias suficientes desde a última vez que lhe tocaste
 * (estudo registado OU bloco de task planeado), só nos dias com folga.
 */
function planReviewBlocks(
  ctx: PlanContext,
  tasks: SchedulerTask[],
  courses: ReviewCourse[],
): void {
  if (courses.length === 0) return;
  const { config, states } = ctx;
  const normalMinutes = config.reviewBlockMinutes ?? DEFAULT_REVIEW_MINUTES;
  const nearMinutes =
    config.reviewBlockMinutesNearDeadline ?? DEFAULT_REVIEW_MINUTES_NEAR;
  const maxPerDay = config.reviewMaxPerDay ?? DEFAULT_REVIEW_MAX_PER_DAY;
  const dailyCap = config.reviewDailyCapMinutes ?? DEFAULT_REVIEW_DAILY_CAP;

  // Último "toque" por cadeira (índice de dia; negativo = no passado).
  const lastTouch = new Map<string, number>(
    courses.map((c) => [c.areaId, -(c.daysSinceStudied ?? 30)]),
  );

  // Dias em que cada cadeira já tem estudo de task planeado.
  const taskAreaById = new Map(tasks.map((t) => [t.taskId, t.areaId]));
  const touchedByDay = states.map((state) => {
    const areas = new Set<string>();
    for (const block of ctx.blocks) {
      if (block.date !== state.day.key || block.kind !== 'task') continue;
      const areaId =
        block.areaId || (block.taskId ? taskAreaById.get(block.taskId) : null);
      if (areaId) areas.add(areaId);
    }
    return areas;
  });

  // Mais urgentes primeiro: avaliação à vista, depois a há mais tempo sem estudo.
  const ordered = [...courses].sort(
    (a, b) =>
      Number(b.hasNearGradedDeadline) - Number(a.hasNearGradedDeadline) ||
      (b.daysSinceStudied ?? 30) - (a.daysSinceStudied ?? 30),
  );

  for (let i = 0; i < states.length; i++) {
    const state = states[i];
    for (const areaId of touchedByDay[i]) lastTouch.set(areaId, i);

    let reviewsToday = 0;
    for (const course of ordered) {
      if (reviewsToday >= maxPerDay) break;

      const gap = course.hasNearGradedDeadline
        ? REVIEW_GAP_DAYS_NEAR
        : REVIEW_GAP_DAYS;
      if (i - (lastTouch.get(course.areaId) ?? -30) < gap) continue;

      const minutes = course.hasNearGradedDeadline ? nearMinutes : normalMinutes;
      if (state.reviewMinutes + minutes > dailyCap) continue;
      // Só com folga real: nunca overtime, e sobra margem no dia.
      const capacity = config.dailyLimitMinutes - REVIEW_KEEP_FREE_MINUTES;
      if (state.usedMinutes + minutes > capacity) continue;

      const { placed } = placeMinutes(
        ctx,
        state,
        minutes,
        capacity,
        { taskId: null, areaId: course.areaId, kind: 'review' },
        minutes,
      );
      if (placed > 0) {
        lastTouch.set(course.areaId, i);
        reviewsToday += 1;
      }
    }
  }
}

export { sumSlots };
