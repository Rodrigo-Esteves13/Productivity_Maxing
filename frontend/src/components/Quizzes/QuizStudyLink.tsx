import { useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import QuizLinkPickers, { type QuizLinkValue } from './QuizLinkPickers';
import { useI18n } from '../../i18n/useI18n';

interface QuizStudyLinkProps {
  areaName: string | null;
  taskTitle: string | null;
  link: QuizLinkValue;
  onSave: (link: QuizLinkValue) => void;
}

// Cartao "Estudo para": liga o quiz a uma cadeira e, se quiser, a uma task
// (ex.: frequencia). O tempo das tentativas vai para essa sessao de foco.
export default function QuizStudyLink({ areaName, taskTitle, link, onSave }: QuizStudyLinkProps) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<QuizLinkValue>(link);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-white">{t('quizzes.link.title')}</h2>
          <p className="mt-1 text-sm text-neutral-400">
            {areaName ? (taskTitle ? t('quizzes.link.summaryTask', { area: areaName, task: taskTitle }) : areaName) : t('quizzes.link.none')}
          </p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setValue(link);
              setEditing(true);
            }}
          >
            {t('quizzes.link.edit')}
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-3">
          <QuizLinkPickers value={value} onChange={setValue} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                onSave(value);
                setEditing(false);
              }}
            >
              {t('quizzes.link.save')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}>
              {t('quizzes.link.cancel')}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
