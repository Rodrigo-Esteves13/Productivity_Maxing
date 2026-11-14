import { useMemo, useState, type FormEvent } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import Input from '../UI/Input';
import ToggleChip from '../UI/ToggleChip';
import { useI18n } from '../../i18n/useI18n';
import {
  buildTest,
  isCorrect,
  scoreTest,
  TEST_KINDS,
  TEST_SIZES,
  type QuestionKind,
  type TestAnswer,
  type TestQuestion,
} from '../../lib/flashcardTest';
import type { Flashcard } from '../../types/models';

interface PracticeTestProps {
  // Cartas do filtro atual (todas, nao so as devidas).
  cards: Flashcard[];
  onExit: () => void;
}

// 0 = todas as cartas do filtro.
const ALL_CARDS = 0;
const SIZE_OPTIONS: number[] = [...TEST_SIZES, ALL_CARDS];

// Teste de pratica: configurar, responder uma a uma, ver nota e erradas.
export default function PracticeTest({ cards, onExit }: PracticeTestProps) {
  const { t } = useI18n();
  const [size, setSize] = useState<number>(TEST_SIZES[1]);
  const [kinds, setKinds] = useState<QuestionKind[]>(TEST_KINDS);
  const [questions, setQuestions] = useState<TestQuestion[] | null>(null);
  const [answers, setAnswers] = useState<TestAnswer[]>([]);
  const [typed, setTyped] = useState('');
  const index = answers.length;

  const toggleKind = (kind: QuestionKind) =>
    setKinds((prev) => (prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]));

  const start = () => {
    setQuestions(buildTest(cards, size === ALL_CARDS ? cards.length : size, kinds));
    setAnswers([]);
    setTyped('');
  };

  const answer = (value: TestAnswer) => {
    setAnswers((prev) => [...prev, value]);
    setTyped('');
  };

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    answer(typed);
  };

  const score = useMemo(
    () => (questions && index >= questions.length ? scoreTest(questions, answers) : null),
    [questions, answers, index],
  );

  if (!questions) {
    return (
      <Card>
        <h2 className="text-lg font-semibold text-white">{t('flashcardTest.title')}</h2>
        <p className="mt-1 text-sm text-neutral-400">{t('flashcardTest.help', { count: cards.length })}</p>
        <p className="mt-4 text-sm font-medium text-neutral-200">{t('flashcardTest.size')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {SIZE_OPTIONS.map((n) => (
            <ToggleChip key={n} size="sm" pressed={size === n} onClick={() => setSize(n)}>
              {n === ALL_CARDS ? t('flashcardTest.sizeAll') : n}
            </ToggleChip>
          ))}
        </div>
        <p className="mt-4 text-sm font-medium text-neutral-200">{t('flashcardTest.kinds')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {TEST_KINDS.map((kind) => (
            <ToggleChip key={kind} size="sm" pressed={kinds.includes(kind)} onClick={() => toggleKind(kind)}>
              {t(`flashcardTest.kind.${kind}`)}
            </ToggleChip>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" disabled={kinds.length === 0} onClick={start}>
            {t('flashcardTest.start')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onExit}>
            {t('common.cancel')}
          </Button>
        </div>
      </Card>
    );
  }

  if (score) {
    return (
      <Card>
        <p className="text-lg font-semibold text-white">
          {t('flashcardTest.score', { correct: score.correct, total: score.total, percent: score.percent })}
        </p>
        {score.missed.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-400">{t('flashcardTest.perfect')}</p>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium text-neutral-200">{t('flashcardTest.missed')}</p>
            <ul className="mt-2 space-y-2">
              {score.missed.map((q) => (
                <li key={q.card.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
                  <p className="break-words font-medium text-white">{q.card.front}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-neutral-300">{q.card.back}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm" onClick={start}>
            {t('flashcardTest.again')}
          </Button>
          <Button variant="secondary" size="sm" onClick={onExit}>
            {t('flashcards.backToDecks')}
          </Button>
        </div>
      </Card>
    );
  }

  const current = questions[index];
  const last = index > 0 ? questions[index - 1] : null;
  const lastRight = last ? isCorrect(last, answers[index - 1]) : null;

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between text-sm text-neutral-400">
        <span className="tabular-nums">{t('flashcards.progress', { current: index + 1, total: questions.length })}</span>
        <Button variant="secondary" size="sm" onClick={onExit}>
          {t('flashcards.endSession')}
        </Button>
      </div>
      {last && (
        <p className={`mb-3 text-xs ${lastRight ? 'text-violet-300' : 'text-red-400'}`} role="status">
          {lastRight ? t('flashcardTest.right') : t('flashcardTest.wrong', { answer: last.card.back })}
        </p>
      )}
      <p className="text-xs uppercase tracking-wide text-neutral-500">{t(`flashcardTest.kind.${current.kind}`)}</p>
      <p className="mt-1 min-h-[3rem] whitespace-pre-wrap break-words text-xl font-semibold text-white">
        {current.card.front}
      </p>
      {current.kind === 'choice' && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {current.options.map((option, i) => (
            <Button key={`${i}-${option}`} variant="secondary" className="min-h-10 justify-start text-left" onClick={() => answer(option)}>
              <span className="whitespace-pre-wrap break-words">{option}</span>
            </Button>
          ))}
        </div>
      )}
      {current.kind === 'trueFalse' && (
        <>
          <p className="mt-4 whitespace-pre-wrap break-words border-t border-neutral-800 pt-4 text-neutral-200">
            {current.shown}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="secondary" className="min-h-10" onClick={() => answer(true)}>
              {t('flashcardTest.true')}
            </Button>
            <Button variant="secondary" className="min-h-10" onClick={() => answer(false)}>
              {t('flashcardTest.false')}
            </Button>
          </div>
        </>
      )}
      {current.kind === 'typed' && (
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitTyped}>
          <Input
            aria-label={t('flashcardTest.yourAnswer')}
            placeholder={t('flashcardTest.yourAnswer')}
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button type="submit" className="min-h-10">
            {t('flashcardTest.check')}
          </Button>
        </form>
      )}
    </Card>
  );
}
