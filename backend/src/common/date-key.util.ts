// Chaves de dia "YYYY-MM-DD" e aritmética de dias, sempre em UTC. A app
// guarda o "dia" de uma aula/turno/task como meia-noite UTC desse dia
// (hora de Lisboa), por isso misturar getters locais aqui reintroduz o
// bug do dia errado já documentado em useSchedule.ts (frontend).

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function diffUtcDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * "Agora" em hora de Lisboa via Intl (o processo corre em UTC no Render,
 * getHours() daria a hora errada metade do ano). `today` é a meia-noite
 * UTC desse dia de calendário, o mesmo formato guardado em aulas/turnos.
 */
export function getLisbonNow(): { today: Date; nowMinutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  const today = new Date(
    Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day'))),
  );
  return {
    today,
    nowMinutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}
