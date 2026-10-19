import Avatar from './Avatar';
import ProfileStat from './ProfileStat';
import type { User } from '../../types/models';
import type { ProfileStats } from '../../utils/profileStats';
import { useI18n } from '../../i18n/useI18n';

interface ProfileHeaderCardProps {
  user: User;
  initials: string;
  stats: ProfileStats;
  isLoadingStats: boolean;
}

export default function ProfileHeaderCard({ user, initials, stats, isLoadingStats }: ProfileHeaderCardProps) {
  const { t } = useI18n();
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt={t('ui.avatar')} size="lg" />

        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white">{user.name || 'Anonymous User'}</h2>
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
    </div>
  );
}
