import { MINUTES_PER_HOUR, MS_PER_MINUTE } from '../common/time.constants';
import { toLisbonWeekdayHour } from '../common/date-key.util';

// Janela por omissao e limites do query param `days`.
export const DISTRACTION_STATS_DEFAULT_DAYS = 90;
export const DISTRACTION_STATS_MIN_DAYS = 7;
export const DISTRACTION_STATS_MAX_DAYS = 365;

// Menos sessoes que isto num balde = amostra pequena (sinal inicial, nao
// conclusao). O balde continua a ser devolvido, so marcado.
export const DISTRACTION_STATS_MIN_SESSIONS = 3;

export const HOURS_PER_DAY = 24;
const PER_HOUR_DECIMALS = 100;

// Ordem fixa dos niveis de esforco (enum Effort do schema). Uma task sem
// esforco conta como MODERATE (regra do schema); uma sessao sem task nao
// tem esforco e fica fora desta dimensao.
export const EFFORT_ORDER = [
  'LIGHT',
  'MODERATE',
  'HEAVY',
  'EXHAUSTIVE',
] as const;
export const DEFAULT_EFFORT = 'MODERATE';

export interface DistractionSessionInput {
  startedAt: Date;
  endedAt: Date | null;
  distractionCount: number;
  area: { id: string; name: string; colorHex: string | null } | null;
  // null = sessao sem task; task sem esforco chega ja resolvida pelo caller
  // como `null` na task e e tratada aqui como DEFAULT_EFFORT.
  task: { effort: string | null } | null;
}

export interface DistractionBucket {
  sessions: number;
  totalMinutes: number;
  distractions: number;
  // Denominador explicito de distractionsPerHour: horas de foco = minutos
  // brutos / 60 (arredondado a 2 casas). distractionsPerHour = distractions
  // / focusHours, com os minutos brutos (nao os arredondados).
  focusHours: number;
  distractionsPerHour: number;
  lowSample: boolean;
}

export interface HourBucket extends DistractionBucket {
  hour: number;
}

export interface AreaBucket extends DistractionBucket {
  areaId: string | null;
  areaName: string | null;
  areaColorHex: string | null;
}

export interface EffortBucket extends DistractionBucket {
  effort: string;
}

export interface DistractionStats {
  windowDays: number;
  minSessions: number;
  // Sessoes terminadas, com duracao > 0, que entraram nas contas.
  totalSessions: number;
  byHour: HourBucket[];
  byArea: AreaBucket[];
  byEffort: EffortBucket[];
}

interface Accumulator {
  sessions: number;
  rawMinutes: number;
  distractions: number;
}

function newAcc(): Accumulator {
  return { sessions: 0, rawMinutes: 0, distractions: 0 };
}

function add(acc: Accumulator, minutes: number, distractions: number): void {
  acc.sessions += 1;
  acc.rawMinutes += minutes;
  acc.distractions += distractions;
}

function round2(value: number): number {
  return Math.round(value * PER_HOUR_DECIMALS) / PER_HOUR_DECIMALS;
}

function finish(acc: Accumulator, minSessions: number): DistractionBucket {
  const focusHours = acc.rawMinutes / MINUTES_PER_HOUR;
  return {
    sessions: acc.sessions,
    totalMinutes: Math.round(acc.rawMinutes),
    distractions: acc.distractions,
    focusHours: round2(focusHours),
    distractionsPerHour: round2(acc.distractions / focusHours),
    lowSample: acc.sessions < minSessions,
  };
}

/**
 * Agrega sessoes terminadas em distracoes por hora do dia (hora de Lisboa do
 * INICIO da sessao), por Area e por nivel de esforco da task. A janela de
 * dias e aplicada pelo caller na query; aqui so se agrega. Baldes sem
 * minutos nao existem (sessao com duracao <= 0 e ignorada), por isso nunca
 * ha divisao por zero.
 */
export function aggregateDistractionStats(
  sessions: DistractionSessionInput[],
  windowDays: number = DISTRACTION_STATS_DEFAULT_DAYS,
  minSessions: number = DISTRACTION_STATS_MIN_SESSIONS,
): DistractionStats {
  const hours = new Map<number, Accumulator>();
  const areas = new Map<
    string,
    { acc: Accumulator; area: DistractionSessionInput['area'] }
  >();
  const efforts = new Map<string, Accumulator>();
  let totalSessions = 0;

  for (const session of sessions) {
    if (!session.endedAt) continue;
    const minutes =
      (session.endedAt.getTime() - session.startedAt.getTime()) / MS_PER_MINUTE;
    if (!(minutes > 0)) continue;
    const distractions = Math.max(0, session.distractionCount);
    totalSessions += 1;

    const { hour } = toLisbonWeekdayHour(session.startedAt);
    const hourAcc = hours.get(hour) ?? newAcc();
    add(hourAcc, minutes, distractions);
    hours.set(hour, hourAcc);

    const areaKey = session.area?.id ?? 'none';
    const areaEntry = areas.get(areaKey) ?? {
      acc: newAcc(),
      area: session.area,
    };
    add(areaEntry.acc, minutes, distractions);
    areas.set(areaKey, areaEntry);

    if (session.task) {
      const effort = session.task.effort ?? DEFAULT_EFFORT;
      const effortAcc = efforts.get(effort) ?? newAcc();
      add(effortAcc, minutes, distractions);
      efforts.set(effort, effortAcc);
    }
  }

  const byHour: HourBucket[] = [];
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    const acc = hours.get(hour);
    if (acc) byHour.push({ hour, ...finish(acc, minSessions) });
  }

  const byArea: AreaBucket[] = Array.from(areas.entries())
    .map(([key, { acc, area }]) => ({
      areaId: key === 'none' ? null : key,
      areaName: area?.name ?? null,
      areaColorHex: area?.colorHex ?? null,
      ...finish(acc, minSessions),
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);

  const byEffort: EffortBucket[] = [];
  for (const effort of EFFORT_ORDER) {
    const acc = efforts.get(effort);
    if (acc) byEffort.push({ effort, ...finish(acc, minSessions) });
  }

  return {
    windowDays,
    minSessions,
    totalSessions,
    byHour,
    byArea,
    byEffort,
  };
}
