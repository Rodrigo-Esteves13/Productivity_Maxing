import Button from '../../UI/Button';
import Input from '../../UI/Input';
import Modal from '../../UI/Modal';
import { useI18n } from '../../../i18n/useI18n';
import { QUIZ_TITLE_MAX } from '../../../lib/quizFormat';

interface QuizRenameModalProps {
  // null = fechado.
  draft: string | null;
  isSaving: boolean;
  onChange: (title: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export default function QuizRenameModal({ draft, isSaving, onChange, onSubmit, onClose }: QuizRenameModalProps) {
  const { t } = useI18n();
  return (
    <Modal isOpen={draft !== null} onClose={onClose} title={t('quickWins.quizRenameTitle')}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <Input
          label={t('quickWins.quizRenameLabel')}
          value={draft ?? ''}
          maxLength={QUIZ_TITLE_MAX}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isSaving || !(draft ?? '').trim()}>
            {t('common.save')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
