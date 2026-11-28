import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { RatedSession } from '../common/session-minutes.util';
import { MS_PER_DAY, MS_PER_SECOND } from '../common/time.constants';
import { PREDICTION_HISTORY_WINDOW_DAYS } from './prediction.constants';

// B-34: tempo de estudo por task somado no Postgres, em vez de carregar cada
// sessao aninhada (studySessions no select) de todas as tasks do user.
//
// Uma linha por (task, nota de concentracao): a soma das duracoes dessas
// sessoes. O peso da concentracao (FOCUS_WEIGHT_BY_RATING) depende so da
// nota, por isso somar primeiro por nota e pesar depois da o mesmo total que
// pesar sessao a sessao. Os arredondamentos e o fallback para o tempo
// recordado continuam nas funcoes de common/session-minutes.util.ts.

export interface TaskRatingSecondsRow {
  taskId: string;
  focusRating: number | null;
  seconds: number | null;
}

// Sem GREATEST por sessao, como sumSessionMinutes (que soma as diferencas e
// so depois corta a 0).
export function taskSessionSecondsSql(
  userId: string,
  taskIds: string[],
): Prisma.Sql {
  return Prisma.sql`
    SELECT s."taskId" AS "taskId",
           s."focusRating" AS "focusRating",
           SUM(EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")))::float8 AS "seconds"
    FROM "StudySession" s
    WHERE s."userId" = ${userId}
      AND s."endedAt" IS NOT NULL
      AND s."taskId" = ANY(${taskIds}::text[])
    GROUP BY s."taskId", s."focusRating"`;
}

// Inicio arbitrario das "sessoes" agregadas: so a duracao conta.
const AGGREGATE_SESSION_START = new Date(0);

/**
 * Sessoes terminadas de cada task, ja agregadas: cada elemento junta todas
 * as sessoes dessa task com a mesma nota numa so, com a duracao somada.
 * Serve diretamente a resolveStudyMinutes / resolveFocusedStudyMinutes.
 */
export async function loadAggregatedTaskSessions(
  prisma: PrismaService,
  userId: string,
  taskIds: string[],
): Promise<Map<string, RatedSession[]>> {
  const byTask = new Map<string, RatedSession[]>();
  if (taskIds.length === 0) return byTask;

  const rows = await prisma.$queryRaw<TaskRatingSecondsRow[]>(
    taskSessionSecondsSql(userId, taskIds),
  );
  for (const row of rows) {
    const durationMs = Math.round(Number(row.seconds ?? 0) * MS_PER_SECOND);
    const sessions = byTask.get(row.taskId) ?? [];
    sessions.push({
      startedAt: AGGREGATE_SESSION_START,
      endedAt: new Date(AGGREGATE_SESSION_START.getTime() + durationMs),
      focusRating: row.focusRating === null ? null : Number(row.focusRating),
    });
    byTask.set(row.taskId, sessions);
  }
  return byTask;
}

/**
 * Janela de historico dos modelos (PREDICTION_HISTORY_WINDOW_DAYS): tasks
 * concluidas dentro dela, ou sem completedAt (por concluir, ou antigas de
 * antes do campo existir) com data dentro dela. Usar dentro de AND: [...].
 */
export function recentHistoryWhere(
  now: Date = new Date(),
): Prisma.TaskWhereInput {
  const since = new Date(
    now.getTime() - PREDICTION_HISTORY_WINDOW_DAYS * MS_PER_DAY,
  );
  return {
    OR: [
      { completedAt: { gte: since } },
      { completedAt: null, date: { gte: since } },
    ],
  };
}
