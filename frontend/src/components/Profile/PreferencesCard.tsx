import { useState } from 'react';
import type { User } from '../../types/models';
import { updateUserProfile } from '../../api/userService';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import ToggleRow from '../UI/ToggleRow';

interface PreferencesCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function PreferencesCard({ user, onUserUpdate }: PreferencesCardProps) {
  const { notify } = useFeedback();
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

  const save = async (patch: {
    deadlineEmailReminders?: boolean;
    deadlinePushReminders?: boolean;
    spacedReviewsEnabled?: boolean;
  }) => {
    setIsSaving(true);
    try {
      onUserUpdate(await updateUserProfile(patch));
    } catch {
      notify(t('ui.couldNotSaveThePreference'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 max-w-3xl mt-8">
      <h2 className="text-lg font-semibold text-white">{t('prefs.notificationsTitle')}</h2>
      <p className="mt-1 mb-2 text-sm text-neutral-400">{t('prefs.savedToAccount')}</p>
      <ToggleRow
        label={t('prefs.reminders')}
        description={t('prefs.remindersHelp')}
        checked={user.deadlineEmailReminders ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ deadlineEmailReminders: value })}
      />
      <ToggleRow
        label={t('prefs.pushReminders')}
        description={t('prefs.pushRemindersHelp')}
        checked={user.deadlinePushReminders ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ deadlinePushReminders: value })}
      />
      <ToggleRow
        label={t('prefs.spacedReviews')}
        description={t('prefs.spacedReviewsHelp')}
        checked={user.spacedReviewsEnabled ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ spacedReviewsEnabled: value })}
      />
    </div>
  );
}
