import Avatar from './Avatar';
import ProfileStat from './ProfileStat';
import type { User } from '../../types/models';
import type { ProfileStats } from '../../utils/profileStats';

interface ProfileHeaderCardProps {
  user: User;
  initials: string;
  stats: ProfileStats;
  isLoadingStats: boolean;
}

export default function ProfileHeaderCard({ user, initials, stats, isLoadingStats }: ProfileHeaderCardProps) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt="Avatar" size="lg" />

        <div className="text-center sm:text-left">
          <h2 className="text-2xl font-bold text-white">{user.name || 'Anonymous User'}</h2>
          <p className="text-neutral-400">{user.email}</p>
          <span className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-xs font-medium rounded-md text-neutral-300">
            {user.role}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-neutral-800">
        <ProfileStat label="Completed Tasks" value={isLoadingStats ? '-' : stats.completed} />
        <ProfileStat label="Active Tasks" value={isLoadingStats ? '-' : stats.active} />
        <ProfileStat label="Projects" value={isLoadingStats ? '-' : stats.projects} />
        <ProfileStat label="Streak" value={isLoadingStats ? '-' : `${stats.streak}d`} />
      </div>
    </div>
  );
}
