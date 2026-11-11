import { useMemo } from 'react';
import { useI18n } from '../../i18n/useI18n';
import { computeBadges, rememberBestStreak } from '../../lib/badges';
import type { ProfileStats } from '../../utils/profileStats';

interface BadgesCardProps {
  stats: ProfileStats;
}

const PERCENT = 100;

export default function BadgesCard({ stats }: BadgesCardProps) {
  const { t } = useI18n();
  const badges = useMemo(
    () =>
      computeBadges({
        completed: stats.completed,
        streak: rememberBestStreak(stats.streak),
        projects: stats.projects,
      }),
    [stats.completed, stats.streak, stats.projects],
  );
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <section className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 mt-4">
      <h2 className="text-lg font-semibold text-white">{t('badges.title')}</h2>
      <p className="text-sm text-neutral-400">
        {t('badges.summary', { earned: earnedCount, total: badges.length })}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <li
            key={`${badge.metric}-${badge.target}`}
            className={`rounded-md border p-3 ${
              badge.earned ? 'border-violet-500 bg-violet-500/10' : 'border-neutral-800 opacity-70'
            }`}
          >
            <p className="text-sm font-medium text-white">
              {t(`badges.${badge.metric}`, { target: badge.target })}
            </p>
            <div className="mt-2 h-1.5 rounded-full bg-neutral-800" aria-hidden="true">
              <div
                className="h-1.5 rounded-full bg-violet-500"
                style={{ width: `${(badge.value / badge.target) * PERCENT}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-neutral-400 tabular-nums">
              {badge.earned ? t('badges.earned') : `${badge.value} / ${badge.target}`}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-neutral-500">{t('badges.hint')}</p>
    </section>
  );
}
