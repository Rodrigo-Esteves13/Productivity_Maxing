import { useState } from 'react';
import type { User } from '../../types/models';
import { updateUserProfile } from '../../api/userService';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { MUTABLE_PUSH_KINDS, toggleMutedKind, type MutablePushKind } from '../../lib/pushKinds';
import ToggleRow from '../UI/ToggleRow';
import Card from '../UI/Card';

interface PushKindsCardProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export default function PushKindsCard({ user, onUserUpdate }: PushKindsCardProps) {
  const { notify } = useFeedback();
  const { t } = useI18n();
  const [isSaving, setIsSaving] = useState(false);
  const muted = user.mutedPushKinds ?? [];

  const change = async (kind: MutablePushKind, enabled: boolean) => {
    setIsSaving(true);
    try {
      onUserUpdate(await updateUserProfile({ mutedPushKinds: toggleMutedKind(muted, kind, enabled) }));
    } catch {
      notify(t('ui.couldNotSaveThePreference'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-white">{t('pushKinds.title')}</h2>
      <p className="mt-1 mb-2 text-sm text-neutral-400">{t('pushKinds.help')}</p>
      {MUTABLE_PUSH_KINDS.map((kind) => (
        <ToggleRow
          key={kind}
          label={t(`pushKinds.${kind}`)}
          description={t(`pushKinds.${kind}Help`)}
          checked={!muted.includes(kind)}
          disabled={isSaving}
          onChange={(value) => void change(kind, value)}
        />
      ))}
    </Card>
  );
}
