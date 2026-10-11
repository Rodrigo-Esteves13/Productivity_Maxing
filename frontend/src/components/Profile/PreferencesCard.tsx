import { useState } from 'react';
import type { User } from '../../types/models';
import { updateUserProfile } from '../../api/userService';
import { useFeedback } from '../../context/useFeedback';

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
    <label className="flex items-start justify-between gap-4 py-3 border-b border-neutral-800 last:border-b-0 cursor-pointer">
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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 mt-6">
      <h2 className="text-lg font-semibold text-white mb-1">Preferences</h2>
      <ToggleRow
        label="Deadline reminders by email"
        description="One email when a pending task is due within about 24 hours. Respects your quiet hours."
        checked={user.deadlineEmailReminders ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ deadlineEmailReminders: value })}
      />
      <ToggleRow
        label="Spaced reviews"
        description="When you complete an academic task (not a test or exam), add short review tasks 1, 3 and 7 days later."
        checked={user.spacedReviewsEnabled ?? false}
        disabled={isSaving}
        onChange={(value) => void save({ spacedReviewsEnabled: value })}
      />
    </div>
  );
}
