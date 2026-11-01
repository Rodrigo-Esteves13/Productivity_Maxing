import Avatar from './Avatar';
import ProfileStat from './ProfileStat';
import type { User } from '../../types/models';
import type { ProfileStats } from '../../utils/profileStats';
import { useI18n } from '../../i18n/useI18n';
import SegmentedControl from '../UI/SegmentedControl';
import { useStreakRestPref } from '../../hooks/useStreakRestPref';
import type { StreakRestMode } from '../../lib/streakRest';

interface ProfileHeaderCardProps {
  user: User;
  initials: string;
  stats: ProfileStats;
  isLoadingStats: boolean;
}

export default function ProfileHeaderCard({ user, initials, stats, isLoadingStats }: ProfileHeaderCardProps) {
  const { t } = useI18n();
  const { mode, setMode, resetMode, isDefault } = useStreakRestPref();
  const restOptions: { value: StreakRestMode; label: string }[] = [
    { value: 'none', label: t('streakFreeze.mode.none') },
    { value: 'weekends', label: t('streakFreeze.mode.weekends') },
    { value: 'weeklyFreeze', label: t('streakFreeze.mode.weeklyFreeze') },
  ];
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt={t('ui.avatar')} size="lg" />

        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white">{user.name || t('ui.anonymousUser')}</h2>
          <p className="text-neutral-400">{user.email}</p>
          <span className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-xs font-medium rounded-md text-neutral-300">
            {user.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-neutral-800">
        <ProfileStat label={t('ui.completedTasks')} value={stats.completed} isLoading={isLoadingStats} />
        <ProfileStat label={t('ui.activeTasks')} value={stats.active} isLoading={isLoadingStats} />
        <ProfileStat label={t('ui.projects')} value={stats.projects} isLoading={isLoadingStats} />
        <ProfileStat label={t('ui.streak')} value={`${stats.streak}d`} isLoading={isLoadingStats} />
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-800 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-neutral-300">{t('streakFreeze.label')}</span>
          <SegmentedControl options={restOptions} value={mode} onChange={setMode} size="sm" />
          {!isDefault && (
            <button
              type="button"
              onClick={resetMode}
              className="press min-h-10 px-2 text-xs text-neutral-400 hover:text-neutral-200"
            >
              {t('ui.resetToDefaults')}
            </button>
          )}
          {!isLoadingStats && stats.restDaysUsed > 0 && (
            <span
              className="px-2 py-1 rounded-md bg-neutral-800 text-xs font-medium text-violet-400 tabular-nums"
              title={t('streakFreeze.restUsedHint')}
            >
              {t('streakFreeze.restUsed', { count: stats.restDaysUsed })}
            </span>
          )}
        </div>
        <p className="text-xs text-neutral-500">{t(`streakFreeze.help.${mode}`)}</p>
      </div>
    </div>
  );
}
