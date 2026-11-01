import type { AreaTeacherNote, CourseRiskOverview, RiskLevel, Task } from '../types/models';
import { getDateStatus, getDeadlineMs } from '../utils/taskDateStatus';
import { hasFirmDate } from './taskReadiness';

export interface AreaOverviewItem {
  areaId: string;
  openTasks: number;
  overdueTasks: number;
  nextDeadline: string | null;
  riskLevel: RiskLevel | null;
  riskScore: number | null;
  currentAverage: number | null;
  teacherName: string | null;
}

function emptyItem(areaId: string): AreaOverviewItem {
  return {
    areaId,
    openTasks: 0,
    overdueTasks: 0,
    nextDeadline: null,
    riskLevel: null,
    riskScore: null,
    currentAverage: null,
    teacherName: null,
  };
}

// Junta tarefas, risco e docentes por cadeira. Funcao pura: cada fonte pode
// faltar (null/undefined) sem estragar as outras.
//  - aberta = nao COMPLETED;
//  - em atraso = getDateStatus 'overdue' (datas por marcar/surpresa nunca);
//  - proximo prazo = a task aberta com data firme mais proxima que ainda nao
//    passou (hoje conta).
export function buildAreaOverview(
  tasks: readonly Task[] | null | undefined,
  risk: CourseRiskOverview | null | undefined,
  teachers: readonly AreaTeacherNote[] | null | undefined,
  now: Date = new Date(),
): Map<string, AreaOverviewItem> {
  const map = new Map<string, AreaOverviewItem>();
  const get = (areaId: string): AreaOverviewItem => {
    let item = map.get(areaId);
    if (!item) {
      item = emptyItem(areaId);
      map.set(areaId, item);
    }
    return item;
  };
  const nextMs = new Map<string, number>();

  for (const task of tasks ?? []) {
    if (task.progressStatus === 'COMPLETED') continue;
    const item = get(task.areaId);
    item.openTasks += 1;
    if (getDateStatus(task, now) === 'overdue') {
      item.overdueTasks += 1;
      continue;
    }
    if (!hasFirmDate(task)) continue;
    const ms = getDeadlineMs(task);
    if (Number.isNaN(ms)) continue;
    const best = nextMs.get(task.areaId);
    if (best === undefined || ms < best) {
      nextMs.set(task.areaId, ms);
      item.nextDeadline = task.date;
    }
  }

  for (const row of risk?.courses ?? []) {
    const item = get(row.areaId);
    item.riskLevel = row.risk?.level ?? null;
    item.riskScore = row.risk?.score ?? null;
    item.currentAverage = row.risk?.currentAverage ?? null;
  }

  for (const note of teachers ?? []) {
    const name = note.teacherName.trim();
    if (name) get(note.areaId).teacherName = name;
  }

  return map;
}
