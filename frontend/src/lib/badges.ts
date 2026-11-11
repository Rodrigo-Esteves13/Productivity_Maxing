// Conquistas por marcos. Puro e sem BD: tudo calculado dos numeros do perfil.
export const BADGE_METRICS = ['completed', 'streak', 'projects'] as const;
export type BadgeMetric = (typeof BADGE_METRICS)[number];

export const BADGE_TARGETS: Record<BadgeMetric, readonly number[]> = {
  completed: [1, 10, 50, 100, 500],
  streak: [3, 7, 30, 100],
  projects: [1, 5],
};

export interface BadgeProgress {
  metric: BadgeMetric;
  target: number;
  value: number;
  earned: boolean;
}

export type BadgeValues = Record<BadgeMetric, number>;

export function computeBadges(values: BadgeValues): BadgeProgress[] {
  return BADGE_METRICS.flatMap((metric) =>
    BADGE_TARGETS[metric].map((target) => ({
      metric,
      target,
      value: Math.min(values[metric], target),
      earned: values[metric] >= target,
    })),
  );
}

export const BEST_STREAK_STORAGE_KEY = 'pmaxing.bestStreak';

export function readBestStreak(): number {
  try {
    const raw = Number(localStorage.getItem(BEST_STREAK_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  } catch {
    return 0;
  }
}

/** Guarda e devolve o melhor streak visto neste dispositivo (nunca desce). */
export function rememberBestStreak(current: number): number {
  const best = Math.max(readBestStreak(), current);
  try {
    localStorage.setItem(BEST_STREAK_STORAGE_KEY, String(best));
  } catch {
    // sem armazenamento: o valor atual continua a valer nesta sessao
  }
  return best;
}
