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
