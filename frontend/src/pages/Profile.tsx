import { useEffect, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Avatar from '../components/Profile/Avatar';
import ProfileStat from '../components/Profile/ProfileStat';
import { getUserProfile } from '../api/userService';
import type { User } from '../types/models';

export default function Profile() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const userData = await getUserProfile();
        setUser(userData);
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError('Could not load profile data.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, []);

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-400 animate-pulse">Loading profile...</p>
        </div>
      </PageLayout>
    );
  }

  if (error || !user) {
    return (
      <PageLayout>
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
          {error || 'User not found.'}
        </div>
      </PageLayout>
    );
  }

  // Fallback for avatar initials if name is null
  const initials = user.name ? user.name.substring(0, 2).toUpperCase() : 'US';

  return (
    <PageLayout>
      <PageHeader 
        title="User Profile" 
        description="Manage your personal information and settings." 
      />
      
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 max-w-3xl">
        <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
          
          {/* If the user has an avatarUrl from Google/Discord, show image, else show Initials */}
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="h-24 w-24 rounded-full border-2 border-neutral-700 shadow-lg" />
          ) : (
            <Avatar initials={initials} size="lg" />
          )}
          
          <div className="text-center sm:text-left">
            <h2 className="text-2xl font-bold text-white">{user.name || 'Anonymous User'}</h2>
            <p className="text-neutral-400">{user.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-neutral-800 text-xs font-medium rounded-md text-neutral-300">
              {user.role}
            </span>
          </div>
        </div>

        {/* Stats Placeholder (We will connect this to your Tasks/Areas later) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-neutral-800">
          <ProfileStat label="Completed Tasks" value="-" />
          <ProfileStat label="Active Tasks" value="-" />
          <ProfileStat label="Projects" value="-" />
          <ProfileStat label="Streak" value="-" />
        </div>
      </div>
    </PageLayout>
  );
}