import type { Task } from '../types/models';
import type { DashboardWidgetKey } from '../hooks/useDashboardWidgetPrefs';
import { hasFirmDate } from './taskReadiness';

// Modo "semana de exames" do Dashboard: so testes e exames na tabela, a
// contagem decrescente no topo e o resto dos cartoes escondido.

const COMPLETED_STATUS: Task['progressStatus'] = 'COMPLETED';

// Cartao que continua visivel em modo exame (se a pessoa nao o escondeu):
// o dia de hoje continua a interessar no meio dos exames.
const KEPT_IN_EXAM_MODE: DashboardWidgetKey[] = ['today'];

/** Teste ou exame: o tipo academico e um evento de data fixa (mesmo sinal do Schedule). */
export function isExamTask(task: Task): boolean {
  return task.academicTypeIsEvent === true;
}

/** Testes e exames por fazer de hoje em diante, do mais proximo para o mais distante. */
export function upcomingExams(tasks: Task[], todayKey: string): Task[] {
  return tasks
    .filter((task) => isExamTask(task) && task.progressStatus !== COMPLETED_STATUS)
    .filter((task) => hasFirmDate(task) && task.date.slice(0, 10) >= todayKey)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Visibilidade dos cartoes em modo exame: tudo escondido menos KEPT_IN_EXAM_MODE. */
export function examModeVisibility(
  visibility: Record<DashboardWidgetKey, boolean>,
): Record<DashboardWidgetKey, boolean> {
  const result = { ...visibility };
  for (const key of Object.keys(result) as DashboardWidgetKey[]) {
    result[key] = KEPT_IN_EXAM_MODE.includes(key) && visibility[key];
  }
  return result;
}
