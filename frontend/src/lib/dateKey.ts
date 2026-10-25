// Chaves de dia "YYYY-MM-DD". Antes havia uma copia de
// toISOString().slice(0, 10) em onze ficheiros, com duas grafias.
//
// Regra unica para "hoje" (F-09). Ha tres funcoes e cada uma tem um uso:
//
// 1. todayKey(): o dia de calendario que a pessoa ve no relogio dela (fuso
//    do browser). E o "hoje" de toda a UI: data por omissao de forms, "Today"
//    no reagendamento, estado "today/overdue/upcoming" das tasks, horario.
//    Igual a toDateKey(todayUtcAnchored()) (lib/weekDates.ts).
// 2. lisbonTodayKey(): o dia de calendario em Lisboa. So para dados que o
//    backend guarda por dia de Lisboa (getLisbonNow / toLisbonDateKey em
//    backend/src/common/date-key.util.ts): medicacao, humor, totais diarios
//    de estudo. Usar o dia local aqui escrevia no dia errado entre 00:00 e
//    01:00 de Lisboa no verao (D-05).
// 3. toDateKey(date): corta a data em UTC. So para instantes que ja estao
//    ancorados a meia-noite UTC (tasks sem hora, dias do horario, datas
//    criadas com Date.UTC). Nunca para "agora".
//
// Para o dia local de um instante qualquer (por exemplo uma task com hora),
// usar toLocalDateKey(date).

/** Fuso usado pelo backend para o "dia" de medicacao, humor e estudo. */
export const APP_TIME_ZONE = 'Europe/Lisbon';

/** "YYYY-MM-DD" (UTC) de uma data. Ver a regra 3 acima. */
export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" do dia de calendario local (fuso do browser) de um instante. */
export function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Chave do dia de hoje no fuso do browser. Ver a regra 1 acima. */
export function todayKey(now: Date = new Date()): string {
  return toLocalDateKey(now);
}

// en-CA formata como "YYYY-MM-DD". Criado uma vez (Intl e caro de construir).
const lisbonDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** "YYYY-MM-DD" do dia de calendario em Lisboa de um instante (igual ao backend). */
export function toLisbonDateKey(date: Date): string {
  return lisbonDayFormatter.format(date);
}

/** Chave do dia de hoje em Lisboa. Ver a regra 2 acima. */
export function lisbonTodayKey(now: Date = new Date()): string {
  return toLisbonDateKey(now);
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

/**
 * Dia de calendario de uma task: o dia guardado (UTC) se nao tem hora, o dia
 * local do instante se tem hora. Comparavel com todayKey().
 */
export function taskDayKey(date: Date): string {
  return isUtcMidnight(date) ? toDateKey(date) : toLocalDateKey(date);
}
