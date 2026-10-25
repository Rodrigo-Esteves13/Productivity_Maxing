import { APP_TIME_ZONE } from './dateKey';

/**
 * O relogio do dispositivo marca agora a mesma hora que Lisboa? As horas da
 * medicacao (e as horas de silencio) sao guardadas e disparadas em hora de
 * Lisboa; fora desse fuso o aviso chega a outra hora local. Compara a hora
 * de parede (nao o nome do fuso): Londres ou Madeira contam como iguais.
 */
export function deviceMatchesAppTimeZone(now: Date = new Date()): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return get('hour') === now.getHours() && get('minute') === now.getMinutes();
  } catch {
    return true;
  }
}
