import { Prisma, ProgressStatus } from '@prisma/client';

// B-39: as tasks ja avisadas saem no Postgres. O marcador SentReminder e por
// [task, prazo] e o Prisma nao compara uma coluna da task com uma da relacao,
// por isso o filtro "ainda sem lembrete para ESTE prazo" vive aqui, com um
// NOT EXISTS por prazo (`date` e `submissionDate`). Os restantes filtros
// (preferencias do user, ban, certeza da data) continuam no where do Prisma.
//
// Sempre parametrizado (Prisma.sql). O Prisma guarda DateTime como
// timestamp(3) sem fuso, em UTC: o instante vai como texto ISO e o cast para
// timestamp ignora o "Z", por isso a comparacao e em UTC seja qual for o fuso
// da sessao do Postgres.

export interface ReminderWindow {
  gt: Date;
  lte: Date;
}

function utcTimestamp(value: Date): Prisma.Sql {
  return Prisma.sql`${value.toISOString()}::timestamp`;
}

function pendingDeadline(
  column: Prisma.Sql,
  window: ReminderWindow,
): Prisma.Sql {
  return Prisma.sql`(
    ${column} > ${utcTimestamp(window.gt)}
    AND ${column} <= ${utcTimestamp(window.lte)}
    AND NOT EXISTS (
      SELECT 1 FROM "SentReminder" s
      WHERE s."taskId" = t."id" AND s."taskDate" = ${column}
    )
  )`;
}

/**
 * Ids das tasks por concluir com pelo menos um prazo na janela ainda sem
 * lembrete, pela ordem do envio (prazo mais proximo primeiro).
 */
export function pendingReminderTaskIdsSql(
  window: ReminderWindow,
  limit: number,
): Prisma.Sql {
  return Prisma.sql`
    SELECT t."id"
    FROM "Task" t
    WHERE t."progressStatus"::text <> ${ProgressStatus.COMPLETED}
      AND (
        ${pendingDeadline(Prisma.sql`t."date"`, window)}
        OR ${pendingDeadline(Prisma.sql`t."submissionDate"`, window)}
      )
    ORDER BY t."date" ASC, t."id" ASC
    LIMIT ${limit}
  `;
}
