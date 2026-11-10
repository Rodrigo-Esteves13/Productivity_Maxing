import type { StreakFreezeStatus } from '../api/streakFreezesService';

// O que o botao "Usar um dia de descanso" mostra para hoje.
// - active: hoje ja e dia de descanso (mostra o estado e deixa desfazer);
// - available: pode pedir (sem sessao hoje e com vaga esta semana);
// - hidden: nao da (ja estudou hoje ou acabou o limite semanal).
export type RestDayView = 'active' | 'available' | 'hidden';

export function restDayView(status: StreakFreezeStatus | null): RestDayView {
  if (!status) return 'hidden';
  if (status.todayFreezeId) return 'active';
  return status.canFreezeToday ? 'available' : 'hidden';
}

// Quantos dias de descanso ainda ha esta semana (nunca negativo).
export function restDaysLeft(status: StreakFreezeStatus): number {
  return Math.max(0, status.maxPerWeek - status.usedThisWeek);
}
