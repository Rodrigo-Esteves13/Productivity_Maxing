// A que task pertence cada sessao de estudo. Funcao pura (sem BD), usada
// pelas previsoes de nota, pelo efeito do foco e pelo grafico de pontos,
// para os tres verem exatamente o mesmo estudo.
//
// - Sessao ligada a uma task: e dessa task (seja quando for).
// - Sessao so da cadeira (sem task): conta para o PROXIMO prazo dessa
//   cadeira, se for nos AREA_SESSION_WINDOW_DAYS dias seguintes. E o caso
//   de quem estuda "Redes" em geral na semana antes do teste de Redes.
// - Sessao sem task nem cadeira: nao se sabe para que foi, nao conta.
import { MS_PER_DAY } from '../common/time.constants';

export const AREA_SESSION_WINDOW_DAYS = 14;

export interface AttributionTask {
  id: string;
  areaId: string;
  // Prazo. Tasks so com dia vem a meia-noite UTC: o proprio dia conta.
  date: Date;
}

export interface AttributableSession {
  taskId: string | null;
  areaId: string | null;
  startedAt: Date;
  endedAt: Date | null;
}

const deadlineEnd = (task: AttributionTask) => task.date.getTime() + MS_PER_DAY;

export function attributeSessions<S extends AttributableSession>(
  tasks: AttributionTask[],
  sessions: S[],
): Map<string, S[]> {
  const taskIds = new Set(tasks.map((task) => task.id));
  const tasksByArea = new Map<string, AttributionTask[]>();
  for (const task of tasks) {
    const list = tasksByArea.get(task.areaId) ?? [];
    list.push(task);
    tasksByArea.set(task.areaId, list);
  }
  for (const list of tasksByArea.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  const windowMs = AREA_SESSION_WINDOW_DAYS * MS_PER_DAY;
  const result = new Map<string, S[]>();
  const add = (taskId: string, session: S) => {
    const list = result.get(taskId) ?? [];
    list.push(session);
    result.set(taskId, list);
  };

  for (const session of sessions) {
    if (!session.endedAt) continue;
    if (session.taskId) {
      // Ligada a outra task (fora da lista): e dessa, nao se reatribui.
      if (taskIds.has(session.taskId)) add(session.taskId, session);
      continue;
    }
    if (!session.areaId) continue;
    const at = session.startedAt.getTime();
    const next = tasksByArea
      .get(session.areaId)
      ?.find((task) => deadlineEnd(task) >= at);
    if (next && deadlineEnd(next) - at <= windowMs) add(next.id, session);
  }
  return result;
}
