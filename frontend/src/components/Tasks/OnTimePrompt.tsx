import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import ActionButton from '../UI/ActionButton';
import ToggleChip from '../UI/ToggleChip';
import { updateTask } from '../../api/userService';
import { announceOnTimeSaved, onAskOnTime, onTimeQuestions, type OnTimePhase } from '../../lib/onTimeQuestion';
import { formatTaskDate } from '../../lib/timeFormat';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import type { Task } from '../../types/models';

type Answers = Partial<Record<OnTimePhase, boolean>>;

const QUESTION_KEY: Record<OnTimePhase, string> = {
  submission: 'onTime.askSubmission',
  main: 'onTime.askMain',
};

// Montado uma vez (App): quem conclui uma task fora do prazo chama
// askIfFinishedOnTime e isto pergunta "acabaste a tempo?", uma task de cada
// vez. Saltar deixa o calculo normal (por completedAt).
export default function OnTimePrompt() {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const [queue, setQueue] = useState<Task[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(
    () =>
      onAskOnTime((tasks) =>
        setQueue((prev) => [...prev, ...tasks.filter((task) => !prev.some((p) => p.id === task.id))]),
      ),
    [],
  );

  const current = queue[0];
  if (!current) return null;

  const phases = onTimeQuestions(current);
  const isTwoPhase = Boolean(current.submissionDate);
  // Reaberto a partir do detalhe: parte da resposta que ja estava gravada.
  const stored: Answers = {
    ...(current.onTime != null && { main: current.onTime }),
    ...(current.submissionOnTime != null && { submission: current.submissionOnTime }),
  };
  const answerOf = (phase: OnTimePhase) => answers[phase] ?? stored[phase];
  const next = () => {
    setAnswers({});
    setQueue((prev) => prev.slice(1));
  };

  const save = async () => {
    setIsSaving(true);
    const main = answerOf('main');
    const submission = answerOf('submission');
    try {
      const updated = await updateTask(current.id, {
        ...(main !== undefined && { onTime: main }),
        ...(submission !== undefined && { submissionOnTime: submission }),
      });
      announceOnTimeSaved(updated);
      notify(t('onTime.saved'), 'success');
    } catch {
      notify(t('onTime.failed'), 'error');
    } finally {
      setIsSaving(false);
      next();
    }
  };

  const answeredAll = phases.every((phase) => answerOf(phase) !== undefined);

  return (
    // Acima do detalhe da task e do check-in de atrasadas (z-60), de onde
    // tambem se abre; abaixo das confirmacoes (z-70).
    <div className="relative z-[65]">
      <Modal isOpen onClose={next} title={t('onTime.title')}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-300">{t('onTime.intro', { title: current.title })}</p>
          {phases.map((phase) => {
            const due = phase === 'submission' ? current.submissionDate : current.date;
            return (
              <fieldset key={phase}>
                <legend className="mb-1.5 text-sm font-medium text-neutral-200">
                  {t(isTwoPhase ? QUESTION_KEY[phase] : 'onTime.askSingle', {
                    date: due ? formatTaskDate(due, lang) : '',
                  })}
                </legend>
                <div className="flex gap-1.5">
                  <ToggleChip
                    size="sm"
                    pressed={answerOf(phase) === true}
                    onClick={() => setAnswers((prev) => ({ ...prev, [phase]: true }))}
                  >
                    {t('onTime.yes')}
                  </ToggleChip>
                  <ToggleChip
                    size="sm"
                    pressed={answerOf(phase) === false}
                    onClick={() => setAnswers((prev) => ({ ...prev, [phase]: false }))}
                  >
                    {t('onTime.no')}
                  </ToggleChip>
                </div>
              </fieldset>
            );
          })}
          <p className="text-xs text-neutral-500">{t('onTime.help')}</p>
          <div className="flex gap-2">
            <ActionButton disabled={isSaving || !answeredAll} onClick={() => void save()}>
              {isSaving ? t('common.saving') : t('onTime.save')}
            </ActionButton>
            <button type="button" onClick={next} className="px-3 py-2 text-sm text-neutral-400 hover:text-white">
              {t('onTime.skip')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
