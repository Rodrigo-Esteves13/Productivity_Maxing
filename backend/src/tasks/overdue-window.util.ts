// Janela do "overdue check-in" (a pergunta "isto já está feito?"). Fica
// fora do TasksService para se poder testar sem base de dados.

// Dias INTEIROS que uma task tem de estar fora de prazo antes de a app
// perguntar. Com 0 perguntava logo no dia seguinte; com 1 (default) uma
// frequência de ontem só gera a pergunta amanhã. Existe porque avaliações
// (testes, exames) raramente são marcadas como feitas no próprio dia.
export const OVERDUE_CHECKIN_GRACE_DAYS = 1;

const MS_PER_DAY = 86_400_000;

export interface OverdueWindow {
  /** Meia-noite UTC de hoje: só se volta a perguntar se a última pergunta for anterior. */
  startOfToday: Date;
  /** Só tasks com prazo ANTERIOR a isto entram na pergunta. */
  overdueCutoff: Date;
}

/**
 * Dia em UTC, igual ao resto da app (o "dia" de uma task é a meia-noite UTC
 * dessa data, ver date-key.util.ts). Comparar com "agora" fazia uma task de
 * HOJE (meia-noite UTC já passada) aparecer logo de manhã como atrasada.
 */
export function computeOverdueWindow(
  now: Date,
  graceDays: number = OVERDUE_CHECKIN_GRACE_DAYS,
): OverdueWindow {
  const startOfToday = new Date(now);
  startOfToday.setUTCHours(0, 0, 0, 0);
  const overdueCutoff = new Date(
    startOfToday.getTime() - graceDays * MS_PER_DAY,
  );
  return { startOfToday, overdueCutoff };
}

/**
 * Valor de lastOverdueCheckAt depois de a pergunta ser respondida.
 * Sem adiamento (ou 1 dia) = agora, e a pergunta volta amanhã. Adiar N dias
 * grava uma marca no futuro (agora + N-1 dias): a query só inclui tasks cuja
 * marca seja anterior ao início de hoje, por isso fica escondida até lá.
 */
export function computeCheckedAt(now: Date, snoozeDays: number): Date {
  if (snoozeDays <= 1) return now;
  return new Date(now.getTime() + (snoozeDays - 1) * MS_PER_DAY);
}
