import type { RecurrenceFrequency } from '@prisma/client';

// Cálculo PURO de recorrência (sem Prisma nem relógio) - tudo em UTC, como
// o resto das datas das tasks. O tempo do dia (se a task tem hora) é
// preservado porque só se mexe no dia/mês.

/** `date` + 1 passo (N dias/semanas/meses). Mês curto: o dia fica no último dia (31 jan -> 28/29 fev). */
export function addRecurrence(
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number,
): Date {
  const result = new Date(date.getTime());
  const step = Math.max(1, Math.floor(interval));

  if (frequency === 'DAILY') {
    result.setUTCDate(result.getUTCDate() + step);
  } else if (frequency === 'WEEKLY') {
    result.setUTCDate(result.getUTCDate() + 7 * step);
  } else {
    const day = result.getUTCDate();
    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + step);
    const lastDayOfMonth = new Date(
      Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
    ).getUTCDate();
    result.setUTCDate(Math.min(day, lastDayOfMonth));
  }
  return result;
}

/**
 * Próxima ocorrência que NÃO cai antes de `notBefore` (início de hoje): uma
 * tarefa diária concluída com 3 dias de atraso não deve gerar outra já
 * vencida. null se passa do fim da série (`until`, inclusive).
 */
export function nextOccurrence(
  from: Date,
  frequency: RecurrenceFrequency,
  interval: number,
  notBefore: Date,
  until: Date | null,
): Date | null {
  let next = addRecurrence(from, frequency, interval);
  // Tecto de segurança (um DAILY de há 3 anos são ~1100 passos).
  for (let i = 0; i < 2000 && next.getTime() < notBefore.getTime(); i++) {
    next = addRecurrence(next, frequency, interval);
  }
  if (next.getTime() < notBefore.getTime()) return null;
  if (until && next.getTime() > until.getTime()) return null;
  return next;
}
