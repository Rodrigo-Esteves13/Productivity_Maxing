import { Prisma } from '@prisma/client';
import { APP_TIME_ZONE } from '../common/time.constants';

// Agregacoes das sessoes de estudo feitas no Postgres (B-33/S-17): antes
// cada pedido lia TODAS as sessoes terminadas do user e somava em JS.
// Sempre parametrizado (Prisma.sql) e sempre filtrado por userId.
//
// O Prisma guarda DateTime como timestamp(3) sem fuso, em UTC. Para obter o
// relogio de Lisboa (com mudanca de hora) primeiro diz-se ao Postgres que o
// valor e UTC e depois converte-se para APP_TIME_ZONE: o mesmo que o
// Intl.DateTimeFormat com timeZone fazia em JS (toLisbonWeekdayHour,
// toLisbonDateKey).
const DB_STORAGE_TIME_ZONE = 'UTC';

// Formato de to_char igual ao das chaves de dia da app (YYYY-MM-DD).
const SQL_DATE_KEY_FORMAT = 'YYYY-MM-DD';

export function lisbonWallClock(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`((${column} AT TIME ZONE ${DB_STORAGE_TIME_ZONE}::text) AT TIME ZONE ${APP_TIME_ZONE}::text)`;
}

// Duracao de uma sessao em segundos, nunca negativa (como o Math.max(0, ...)
// por sessao do codigo antigo).
const POSITIVE_SECONDS = Prisma.sql`GREATEST(EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt")), 0)`;

export interface WeekdayHourRow {
  dayOfWeek: number; // 0=Domingo..6=Sabado, hora de Lisboa
  hour: number; // 0-23, hora de Lisboa
  totalSeconds: number;
  sessionCount: number;
}

/** Sessoes terminadas por dia da semana x hora de inicio (Lisboa). */
export function weekdayHourTotalsSql(userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT EXTRACT(DOW FROM l."localStart")::int AS "dayOfWeek",
           EXTRACT(HOUR FROM l."localStart")::int AS "hour",
           SUM(l."seconds")::float8 AS "totalSeconds",
           COUNT(*)::int AS "sessionCount"
    FROM (
      SELECT ${lisbonWallClock(Prisma.sql`s."startedAt"`)} AS "localStart",
             ${POSITIVE_SECONDS} AS "seconds"
      FROM "StudySession" s
      WHERE s."userId" = ${userId} AND s."endedAt" IS NOT NULL
    ) l
    GROUP BY 1, 2`;
}

export interface AreaTotalRow {
  areaId: string | null;
  areaName: string | null;
  areaColorHex: string | null;
  totalSeconds: number;
  sessionCount: number;
}

/**
 * Sessoes terminadas por Area. A Area de uma sessao e a dela, senao a da
 * task (COALESCE, igual a `session.area ?? session.task?.area`). Sessoes
 * sem nenhuma ficam todas no grupo com areaId null.
 */
export function areaTotalsSql(userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT a."id" AS "areaId",
           a."name" AS "areaName",
           a."colorHex" AS "areaColorHex",
           SUM(${POSITIVE_SECONDS})::float8 AS "totalSeconds",
           COUNT(*)::int AS "sessionCount"
    FROM "StudySession" s
    LEFT JOIN "Task" t ON t."id" = s."taskId"
    LEFT JOIN "Area" a ON a."id" = COALESCE(s."areaId", t."areaId")
    WHERE s."userId" = ${userId} AND s."endedAt" IS NOT NULL
    GROUP BY a."id", a."name", a."colorHex"`;
}

export interface ActiveDayRow {
  dayKey: string; // YYYY-MM-DD em Lisboa
}

/** Dias de Lisboa distintos com pelo menos uma sessao terminada, por ordem. */
export function activeLisbonDaysSql(userId: string): Prisma.Sql {
  return Prisma.sql`
    SELECT DISTINCT to_char(${lisbonWallClock(Prisma.sql`s."startedAt"`)}, ${SQL_DATE_KEY_FORMAT}::text) AS "dayKey"
    FROM "StudySession" s
    WHERE s."userId" = ${userId} AND s."endedAt" IS NOT NULL
    ORDER BY "dayKey" ASC`;
}
