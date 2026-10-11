import { useState } from 'react';
import type { User } from '../../types/models';
import { updateUserProfile } from '../../api/userService';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';

interface PreferencesCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ label, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-2.5 border-b border-neutral-800 last:border-b-0 cursor-pointer">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-200">{label}</span>
        <span className="block text-xs text-neutral-500 mt-0.5">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-violet-500 shrink-0"
      />
    </label>
  );
}

export default function PreferencesCard({ user, onUserUpdate }: PreferencesCardProps) {
  const { notify } = useFeedback();
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);

  const save = async (patch: { deadlineEmailReminders?: boolean; spacedReviewsEnabled?: boolean }) => {
    setIsSaving(true);
    try {
      onUserUpdate(await updateUserProfile(patch));
    } catch {
      notify('Could not save the preference. Please try again.', 'error');
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
        label={t('prefs.spacedReviews')}
        description={t('prefs.spacedReviewsHelp')}
        checked={user.spacedReviewsEnabled ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ spacedReviewsEnabled: value })}
      />
    </div>
  );
}
