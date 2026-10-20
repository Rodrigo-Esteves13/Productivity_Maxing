// Chaves de dia "YYYY-MM-DD" em UTC. Antes havia uma copia de
// toISOString().slice(0, 10) em onze ficheiros, com duas grafias.

/** "YYYY-MM-DD" (UTC) de uma data. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Chave do dia de hoje, em UTC. */
export function todayKey(): string {
  return toDateKey(new Date());
}

/**
 * As tasks sem hora (o formulario so tem data) ficam guardadas a meia-noite
 * UTC desse dia. True se o instante e exatamente essa meia-noite.
 */
export function isUtcMidnight(date: Date): boolean {
  return (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0
  );
}
