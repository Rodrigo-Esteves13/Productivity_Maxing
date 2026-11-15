import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { ShieldIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { checkQuizText, type QuizCheckStatus } from '../../lib/quizImport';
import { QUIZ_MAX_FILE_BYTES } from '../../lib/quizFormat';
import type { Quiz } from '../../lib/quizFormat';

const PASTE_ROWS = 6;
const SKIP_PREVIEW = 5;
// Espera que o aluno pare de escrever/colar antes de verificar (a verificacao e pesada).
const CHECK_DEBOUNCE_MS = 300;
const ACCEPT = '.json,application/json';

const STATUS_CLASS: Record<QuizCheckStatus, string> = {
  pass: 'text-violet-300',
  warn: 'text-amber-300',
  fail: 'text-red-400',
};

interface QuizUploadModalProps {
  onSave: (quiz: Quiz) => Promise<boolean>;
  onClose: () => void;
}

// Carrega o JSON (ficheiro ou colado), mostra a verificacao de seguranca
// e so grava depois de confirmares. O ficheiro em si nunca e guardado.
export default function QuizUploadModal({ onSave, onClose }: QuizUploadModalProps) {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [fileError, setFileError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Texto ja verificado: segue o `text` com atraso (ficheiro escolhido verifica logo).
  const [checkedText, setCheckedText] = useState('');
  const report = useMemo(() => (text.trim() && checkedText.trim() ? checkQuizText(checkedText) : null), [text, checkedText]);
  const isChecking = text !== checkedText;

  useEffect(() => {
    const timer = setTimeout(() => setCheckedText(text), CHECK_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isJson = file.name.toLowerCase().endsWith('.json');
    setFileError(!isJson || file.size > QUIZ_MAX_FILE_BYTES);
    if (!isJson || file.size > QUIZ_MAX_FILE_BYTES) return;
    const content = await file.text();
    setText(content);
    setCheckedText(content);
  };

  const save = async () => {
    if (!report?.quiz || isChecking || isSaving) return;
    setIsSaving(true);
    const ok = await onSave(report.quiz);
    setIsSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={t('quizzes.upload.title')}>
      <div className="space-y-3 text-sm">
        <p className="text-neutral-400">{t('quizzes.upload.help')}</p>
        <label className="press inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2 text-neutral-200 hover:border-neutral-500">
          {t('quizzes.upload.pick')}
          <input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => void pickFile(e)} />
        </label>
        {fileError && <p className="text-red-400">{t('quizzes.upload.fileError')}</p>}
        <Textarea
          label={t('quizzes.upload.paste')}
          rows={PASTE_ROWS}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('quizzes.upload.pastePlaceholder')}
          className="font-mono text-xs"
        />
        {report && (
          <div className="rounded-lg border border-neutral-800 p-3" role="status">
            <p className="flex items-center gap-2 font-medium text-neutral-200">
              <ShieldIcon className="h-4 w-4 text-violet-300" aria-hidden="true" />
              {t('quizzes.check.title')}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {report.checks.map((c) => (
                <li key={c.id} className={STATUS_CLASS[c.status]}>
                  {t(`quizzes.check.status.${c.status}`)}: {t(`quizzes.check.${c.id}`, { count: c.count })}
                </li>
              ))}
              {report.skipped.slice(0, SKIP_PREVIEW).map((s) => (
                <li key={s.index} className="text-amber-300">
                  {t(`quizzes.skip.${s.reason}`, { number: s.index + 1 })}
                </li>
              ))}
              {report.skipped.length > SKIP_PREVIEW && (
                <li className="text-neutral-500">{t('quizzes.check.moreSkipped', { count: report.skipped.length - SKIP_PREVIEW })}</li>
              )}
            </ul>
          </div>
        )}
        <p className="text-xs text-neutral-500">{t('quizzes.upload.privacy')}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            {t('ui.cancel')}
          </Button>
          <Button type="button" size="sm" disabled={!report?.ok || isChecking || isSaving} onClick={() => void save()}>
            {t('quizzes.upload.save', { count: report?.quiz?.questions.length ?? 0 })}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
