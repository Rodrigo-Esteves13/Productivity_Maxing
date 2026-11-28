import { useState, type FormEvent } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { FEEDBACK_MESSAGE_MAX_LENGTH, FEEDBACK_MESSAGE_MIN_LENGTH, updateMyFeedback } from '../../api/feedbackService';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { getApiMessage } from '../../lib/httpError';

const ROWS = 4;

interface FeedbackEditFormProps {
  id: string;
  initial: string;
  onClose: () => void;
  // Depois de gravar.
  onChanged: () => void;
}

export default function FeedbackEditForm({ id, initial, onClose, onChanged }: FeedbackEditFormProps) {
  const { t } = useI18n();
  const { notify } = useFeedback();
  const [message, setMessage] = useState(initial);
  const [isSaving, setIsSaving] = useState(false);
  const isTooShort = message.trim().length < FEEDBACK_MESSAGE_MIN_LENGTH;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isTooShort || isSaving) return;
    setIsSaving(true);
    try {
      await updateMyFeedback(id, message.trim());
      notify(t('ux4global.feedback.saved'), 'success');
      onClose();
      onChanged();
    } catch (caught) {
      notify(getApiMessage(caught, t('ux4global.feedback.saveFailed')), 'error');
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-2 space-y-2">
      <Textarea
        aria-label={t('ux4global.feedback.label')}
        value={message}
        rows={ROWS}
        maxLength={FEEDBACK_MESSAGE_MAX_LENGTH}
        onChange={(e) => setMessage(e.target.value)}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" disabled={isTooShort || isSaving}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  );
}
