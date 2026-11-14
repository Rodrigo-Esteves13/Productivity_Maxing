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

// Chave i18n do nome: o singular (target 1) tem texto proprio.
export function badgeLabelKey(badge: Pick<BadgeProgress, 'metric' | 'target'>): string {
  const singular = badge.target === 1 && (badge.metric === 'completed' || badge.metric === 'projects');
  return singular ? `badges.${badge.metric}One` : `badges.${badge.metric}`;
}

export function badgeId(badge: Pick<BadgeProgress, 'metric' | 'target'>): string {
  return `${badge.metric}:${badge.target}`;
}

export const EARNED_BADGES_STORAGE_KEY = 'pmaxing.earnedBadges';

/** null = ainda nao ha base de comparacao neste dispositivo. */
export function readEarnedBadgeIds(): string[] | null {
  try {
    const raw = localStorage.getItem(EARNED_BADGES_STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : null;
  } catch {
    return null;
  }
}

export function saveEarnedBadgeIds(ids: readonly string[]): void {
  try {
    localStorage.setItem(EARNED_BADGES_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // sem armazenamento: o aviso pode repetir-se numa proxima sessao
  }
}

export function earnedIds(badges: readonly BadgeProgress[]): string[] {
  return badges.filter((b) => b.earned).map(badgeId);
}

/** Conquistas ganhas que ainda nao estavam na base; vazio sem base (so semeia). */
export function newlyEarned(previous: readonly string[] | null, badges: readonly BadgeProgress[]): BadgeProgress[] {
  if (previous === null) return [];
  return badges.filter((b) => b.earned && !previous.includes(badgeId(b)));
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
