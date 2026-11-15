import { useState } from 'react';
import Button from '../UI/Button';
import Modal from '../UI/Modal';
import ToggleRow from '../UI/ToggleRow';
import QuizLinkPickers, { type QuizLinkValue } from './QuizLinkPickers';
import { useI18n } from '../../i18n/useI18n';

interface QuizFocusPromptProps {
  isOpen: boolean;
  // Cadeira/task ligadas ao quiz (pre-escolhidas).
  link: QuizLinkValue;
  isStarting: boolean;
  onStartWithFocus: (link: QuizLinkValue, neverAsk: boolean) => void;
  onQuizOnly: (neverAsk: boolean) => void;
  onCancel: () => void;
}

// Antes de comecar uma tentativa sem sessao de foco ativa: fazer um quiz e
// estudar, por isso pergunta se quer contar o tempo para a cadeira/task.
export default function QuizFocusPrompt({ isOpen, link, isStarting, onStartWithFocus, onQuizOnly, onCancel }: QuizFocusPromptProps) {
  const { t } = useI18n();
  const [value, setValue] = useState<QuizLinkValue>(link);
  const [neverAsk, setNeverAsk] = useState(false);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={t('quizzes.focus.title')}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-300">{t('quizzes.focus.help')}</p>
        <QuizLinkPickers value={value} onChange={setValue} />
        <ToggleRow variant="inline" label={t('quizzes.focus.neverAsk')} description={t('quizzes.focus.neverAskHelp')} checked={neverAsk} onChange={setNeverAsk} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onQuizOnly(neverAsk)}>
            {t('quizzes.focus.quizOnly')}
          </Button>
          <Button size="sm" disabled={isStarting} onClick={() => onStartWithFocus(value, neverAsk)}>
            {t('quizzes.focus.start')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
