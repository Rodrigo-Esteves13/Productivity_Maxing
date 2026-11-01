// Modos de descanso da streak (estilo Opal). 'none' e o comportamento original.
export type StreakRestMode = 'none' | 'weekends' | 'weeklyFreeze';

export const STREAK_REST_MODES: readonly StreakRestMode[] = ['none', 'weekends', 'weeklyFreeze'];
export const DEFAULT_STREAK_REST_MODE: StreakRestMode = 'none';

export function isStreakRestMode(value: unknown): value is StreakRestMode {
  return typeof value === 'string' && (STREAK_REST_MODES as readonly string[]).includes(value);
}
