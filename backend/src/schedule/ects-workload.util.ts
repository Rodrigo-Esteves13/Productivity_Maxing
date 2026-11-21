import { MS_PER_MINUTE } from '../common/time.constants';
import {
  DATE_KEY_PATTERN,
  lisbonDayBounds,
  parseDateKey,
  toDateKey,
} from '../common/date-key.util';
import { MS_PER_DAY } from '../common/time.constants';

// Maximo de dias (inclusive) que um pedido de carga ECTS pode cobrir: poe
// um teto ao trabalho de BD por pedido.
export const ECTS_MAX_RANGE_DAYS = 400;

// "YYYY-MM-DD" que e mesmo um dia de calendario (rejeita 2026-13-01 e
// 2026-02-31, que a regex sozinha deixa passar).
export function isRealDateKey(value: unknown): boolean {
  if (typeof value !== 'string' || !DATE_KEY_PATTERN.test(value)) return false;
  const parsed = parseDateKey(value);
  return !Number.isNaN(parsed.getTime()) && toDateKey(parsed) === value;
}

// Numero de dias do intervalo, inclusive nas duas pontas.
export function ectsRangeDays(fromKey: string, toKey: string): number {
  return (
    Math.round(
      (parseDateKey(toKey).getTime() - parseDateKey(fromKey).getTime()) /
        MS_PER_DAY,
    ) + 1
  );
}

export interface EctsClassSlice {
  subject: string;
  startMinutes: number;
  endMinutes: number;
  cancelled: boolean;
  // null = ainda por marcar; conta como aula dada.
  attended: boolean | null;
}

export interface EctsStudySlice {
  areaId: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

export interface EctsAreaInput {
  id: string;
  name: string;
  credits: number | null;
}

export interface EctsCourseRow {
  areaId: string;
  name: string;
  credits: number;
  classMinutes: number;
  studyMinutes: number;
}

export interface EctsWorkloadResult {
  courses: EctsCourseRow[];
  unlinkedSubjects: string[];
}

// Janela [start, end) em instantes UTC que cobre os dias de calendario de
// Lisboa de fromKey a toKey (inclusive). Nao e meia-noite UTC: no verao a
// meia-noite de Lisboa e 23:00 UTC do dia anterior.
export function ectsStudyWindow(
  fromKey: string,
  toKey: string,
): { start: Date; end: Date } {
  return {
    start: lisbonDayBounds(fromKey).start,
    end: lisbonDayBounds(toKey).end,
  };
}

// Hoje so contam as aulas que ja acabaram (fim <= agora, em minutos de
// Lisboa); dias anteriores contam inteiros.
export function keepFinishedClasses<T extends { endMinutes: number }>(
  rows: Array<T & { dateKey: string }>,
  todayKey: string,
  nowMinutes: number,
): T[] {
  return rows.filter(
    (row) => row.dateKey !== todayKey || row.endMinutes <= nowMinutes,
  );
}

// Junta aulas dadas (nao canceladas, presenca != false) e estudo terminado
// por cadeira com creditos. Cadeiras sem creditos (>0) ficam de fora.
export function buildEctsWorkload(
  classes: EctsClassSlice[],
  sessions: EctsStudySlice[],
  subjectToArea: Map<string, string>,
  areas: EctsAreaInput[],
  window: { start: Date; end: Date },
): EctsWorkloadResult {
  const classByArea = new Map<string, number>();
  const unlinked = new Set<string>();
  for (const c of classes) {
    if (c.cancelled || c.attended === false) continue;
    const areaId = subjectToArea.get(c.subject);
    if (!areaId) {
      unlinked.add(c.subject);
      continue;
    }
    const minutes = Math.max(0, c.endMinutes - c.startMinutes);
    classByArea.set(areaId, (classByArea.get(areaId) ?? 0) + minutes);
  }

  const studyByArea = new Map<string, number>();
  for (const s of sessions) {
    if (!s.areaId || !s.endedAt) continue;
    const startMs = s.startedAt.getTime();
    if (startMs < window.start.getTime() || startMs >= window.end.getTime()) {
      continue;
    }
    const minutes = Math.max(
      0,
      (s.endedAt.getTime() - startMs) / MS_PER_MINUTE,
    );
    studyByArea.set(s.areaId, (studyByArea.get(s.areaId) ?? 0) + minutes);
  }

  const courses: EctsCourseRow[] = [];
  for (const area of areas) {
    if (area.credits === null || area.credits <= 0) continue;
    courses.push({
      areaId: area.id,
      name: area.name,
      credits: area.credits,
      classMinutes: Math.round(classByArea.get(area.id) ?? 0),
      studyMinutes: Math.round(studyByArea.get(area.id) ?? 0),
    });
  }

  return { courses, unlinkedSubjects: [...unlinked].sort() };
}
