// Folgas fixas de um local (Commitment.daysOff): dias da semana em que se
// nunca trabalha ali. Puro e partilhado pelo serviço de turnos, pela cópia
// de semanas e pelos testes.

// 0=Domingo..6=Sábado (mesma convenção de getUTCDay()).
export function isDayOff(
  daysOff: readonly number[] | null | undefined,
  weekday: number | null,
): boolean {
  return weekday !== null && !!daysOff && daysOff.includes(weekday);
}
