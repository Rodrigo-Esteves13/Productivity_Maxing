import { useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Input from '../UI/Input';
import Select from '../UI/Select';
import Textarea from '../UI/Textarea';
import ToggleChip from '../UI/ToggleChip';
import CopyButton from '../UI/CopyButton';
import { useI18n } from '../../i18n/useI18n';
import { QUIZ_KINDS, type QuizKind } from '../../lib/quizFormat';
import {
  buildQuizPrompt,
  clampQuizCount,
  QUIZ_DIFFICULTIES,
  QUIZ_LANGUAGES,
  QUIZ_NOTES_MAX,
  QUIZ_PROMPT_COUNTS,
  QUIZ_PROMPT_LONG_COUNT,
  QUIZ_PROMPT_MAX_COUNT,
  QUIZ_PROMPT_MIN_COUNT,
  QUIZ_SUBJECT_MAX,
  type QuizDifficulty,
} from '../../lib/quizPrompt';

const DEFAULT_KINDS: QuizKind[] = ['single', 'multi', 'truefalse'];
const DEFAULT_DIFFICULTIES: QuizDifficulty[] = ['exam'];
const DEFAULT_COUNT = QUIZ_PROMPT_COUNTS[1];
const PROMPT_PREVIEW_ROWS = 8;
const NOTES_ROWS = 4;

interface QuizPromptModalProps {
  onClose: () => void;
}

const splitTopics = (text: string) =>
  text
    .split(/[,\n;]/)
    .map((t) => t.trim())
    .filter(Boolean);

// Monta o prompt para colar em qualquer IA. Nada sai do browser.
export default function QuizPromptModal({ onClose }: QuizPromptModalProps) {
  const { t } = useI18n();
  const [subject, setSubject] = useState('');
  const [topics, setTopics] = useState('');
  // Texto do campo (pode estar vazio a meio da escrita); o valor usado e sempre limitado.
  const [countText, setCountText] = useState(String(DEFAULT_COUNT));
  const [difficulties, setDifficulties] = useState<QuizDifficulty[]>(DEFAULT_DIFFICULTIES);
  const [language, setLanguage] = useState(QUIZ_LANGUAGES[0].code);
  const [kinds, setKinds] = useState<QuizKind[]>(DEFAULT_KINDS);
  const [webResearch, setWebResearch] = useState(true);
  const [figures, setFigures] = useState(true);
  const [notes, setNotes] = useState('');

  const count = clampQuizCount(parseInt(countText, 10));
  const prompt = useMemo(
    () => buildQuizPrompt({ subject, topics: splitTopics(topics), count, difficulties, language, kinds, webResearch, figures, notes }),
    [subject, topics, count, difficulties, language, kinds, webResearch, figures, notes],
  );

  const toggleDifficulty = (level: QuizDifficulty) =>
    setDifficulties((prev) => (prev.includes(level) ? (prev.length > 1 ? prev.filter((d) => d !== level) : prev) : [...prev, level]));

  const toggleKind = (kind: QuizKind) =>
    setKinds((prev) => (prev.includes(kind) ? (prev.length > 1 ? prev.filter((k) => k !== kind) : prev) : [...prev, kind]));

  return (
    <Modal isOpen onClose={onClose} title={t('quizzes.prompt.title')} size="wide">
      <div className="space-y-4 text-sm">
        <p className="text-neutral-400">{t('quizzes.prompt.help')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('quizzes.prompt.subject')} value={subject} maxLength={QUIZ_SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} placeholder={t('quizzes.prompt.subjectPlaceholder')} />
          <Input label={t('quizzes.prompt.topics')} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={t('quizzes.prompt.topicsPlaceholder')} />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-neutral-300">{t('quizzes.prompt.count')}</span>
            {QUIZ_PROMPT_COUNTS.map((n) => (
              <ToggleChip key={n} size="sm" pressed={count === n} onClick={() => setCountText(String(n))}>
                {n}
              </ToggleChip>
            ))}
          </div>
          <div className="max-w-xs">
            <Input
              type="number"
              inputMode="numeric"
              label={t('quizzes.prompt.customCount')}
              min={QUIZ_PROMPT_MIN_COUNT}
              max={QUIZ_PROMPT_MAX_COUNT}
              value={countText}
              onChange={(e) => setCountText(e.target.value)}
              onBlur={() => setCountText(String(count))}
            />
          </div>
          {count > QUIZ_PROMPT_LONG_COUNT && <p className="text-xs text-amber-400">{t('quizzes.prompt.longHint', { count: QUIZ_PROMPT_LONG_COUNT })}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-300">{t('quizzes.prompt.difficulty')}</span>
          {QUIZ_DIFFICULTIES.map((d) => (
            <ToggleChip key={d} size="sm" pressed={difficulties.includes(d)} onClick={() => toggleDifficulty(d)}>
              {t(`quizzes.difficulty.${d}`)}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-neutral-300">{t('quizzes.prompt.kinds')}</span>
          {QUIZ_KINDS.map((k) => (
            <ToggleChip key={k} size="sm" pressed={kinds.includes(k)} onClick={() => toggleKind(k)}>
              {t(`quizzes.kind.${k}`)}
            </ToggleChip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip pressed={figures} onClick={() => setFigures((v) => !v)}>
            {t('quizzes.prompt.figures')}
          </ToggleChip>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={t('quizzes.prompt.language')} value={language} onChange={(e) => setLanguage(e.target.value)}>
            {QUIZ_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {t(`quizzes.language.${l.code}`)}
              </option>
            ))}
          </Select>
          <div className="flex items-end">
            <ToggleChip pressed={webResearch} onClick={() => setWebResearch((v) => !v)}>
              {t('quizzes.prompt.web')}
            </ToggleChip>
          </div>
        </div>
        <Textarea
          label={t('quizzes.prompt.notes')}
          rows={NOTES_ROWS}
          maxLength={QUIZ_NOTES_MAX}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('quizzes.prompt.notesPlaceholder')}
        />
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-medium text-neutral-200">{t('quizzes.prompt.preview')}</span>
            <CopyButton text={prompt} label={t('quizzes.prompt.copy')} />
          </div>
          <Textarea aria-label={t('quizzes.prompt.preview')} rows={PROMPT_PREVIEW_ROWS} value={prompt} readOnly className="font-mono text-xs" />
          <p className="mt-2 text-xs text-neutral-500">{t('quizzes.prompt.next')}</p>
        </div>
      </div>
    </Modal>
  );
}
