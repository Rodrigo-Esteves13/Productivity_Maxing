import { useMemo, useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import Input from '../UI/Input';
import ProgressBar from '../UI/ProgressBar';
import TabBar from '../UI/TabBar';
import ToggleChip from '../UI/ToggleChip';
import QuestionView, { QuestionPrompt } from './QuestionView';
import { useI18n } from '../../i18n/useI18n';
import type { QuizDetail } from '../../api/quizzesService';
import { formatElapsed } from '../../lib/formatDuration';
import { formatRelativeTime } from '../../lib/money';
import { QUIZ_KINDS, type QuizKind, type QuizQuestion } from '../../lib/quizFormat';
import {
  EXAM_SIZES,
  answerKeyItem,
  MS_PER_SECOND,
  pickExam,
  pickPractice,
  PRACTICE_SIZES,
  topicMastery,
  wasAnswered,
  wrongQuestions,
  type QuizMode,
  type QuizSession,
} from '../../lib/quizSession';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { foldText } from '../../lib/textSearch';

type HomeTab = 'modes' | 'bank' | 'history';
const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;

interface QuizHomeProps {
  quiz: QuizDetail;
  // Tentativa a meio (guardada neste dispositivo), se houver.
  session: QuizSession | null;
  onStart: (mode: QuizMode, questions: QuizQuestion[]) => void;
  onResume: () => void;
  // Termina ja: so as respondidas contam (ou nada se for curta demais).
  onFinishNow: () => void;
  onDiscard: () => void;
}

// Inicio de um quiz: modos (exame, pratica, erradas), dominio por topico,
// banco de perguntas e historico, como no quiz de exemplo.
export default function QuizHome({ quiz, session, onStart, onResume, onFinishNow, onDiscard }: QuizHomeProps) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<HomeTab>('modes');
  const [examSize, setExamSize] = useState<number>(EXAM_SIZES[0]);
  const [topics, setTopics] = useState<string[]>([]);
  const [kinds, setKinds] = useState<QuizKind[]>([]);
  const [practiceSize, setPracticeSize] = useState<number>(PRACTICE_SIZES[0]);
  const [search, setSearch] = useState('');

  const presentKinds = useMemo(() => QUIZ_KINDS.filter((k) => quiz.questions.some((q) => q.kind === k)), [quiz.questions]);
  const wrong = useMemo(() => wrongQuestions(quiz, quiz.stats), [quiz]);
  const mastery = useMemo(() => topicMastery(quiz, quiz.stats), [quiz]);
  const practicePool = pickPractice(quiz, topics, kinds, quiz.questions.length).length;
  const bank = useMemo(() => {
    const needle = foldText(search.trim());
    return quiz.questions.filter(
      (q) => (topics.length === 0 || topics.includes(q.topic)) && (!needle || foldText(`${q.prompt} ${q.options.join(' ')}`).includes(needle)),
    );
  }, [quiz.questions, search, topics]);

  const answeredInSession = useMemo(() => {
    if (!session) return 0;
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    return session.items.filter((it) => {
      const q = byId.get(it.id);
      return q ? wasAnswered(q, it, session.mode) : false;
    }).length;
  }, [session, quiz.questions]);
  const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const examSizes = EXAM_SIZES.filter((n) => n < quiz.questions.length);

  return (
    <div className="space-y-4">
      <TabBar
        label={t('quizzes.home.tabs')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'modes', label: t('quizzes.home.modes') },
          { value: 'bank', label: t('quizzes.home.bank'), count: quiz.questions.length },
          { value: 'history', label: t('quizzes.home.history'), count: quiz.attempts.length },
        ]}
      />

      {tab === 'modes' && (
        <>
          {session && (
            <Card className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-neutral-200">
                {t('quizzes.home.inProgressDetail', {
                  answered: answeredInSession,
                  total: session.items.length,
                  when: formatRelativeTime(new Date(session.lastActiveAt ?? session.startedAt).toISOString(), lang),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={onResume}>
                  {t('quizzes.home.resume')}
                </Button>
                <Button variant="secondary" size="sm" onClick={onFinishNow}>
                  {t('quizzes.home.finishNow')}
                </Button>
                <Button variant="secondary" size="sm" onClick={onDiscard}>
                  {t('quizzes.home.discard')}
                </Button>
              </div>
            </Card>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h2 className="font-semibold text-white">{t('quizzes.mode.exam')}</h2>
              <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.examHelp', { seconds: quiz.secondsPerQuestion })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...examSizes, quiz.questions.length].map((n) => (
                  <ToggleChip key={n} size="sm" pressed={examSize === n} onClick={() => setExamSize(n)}>
                    {t('quizzes.home.examSize', { count: n, minutes: Math.ceil((n * quiz.secondsPerQuestion) / SECONDS_PER_MINUTE) })}
                  </ToggleChip>
                ))}
              </div>
              <Button size="sm" className="mt-4" onClick={() => onStart('exam', pickExam(quiz, examSize))}>
                {t('quizzes.home.startExam')}
              </Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-white">{t('quizzes.mode.practice')}</h2>
              <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.practiceHelp')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {quiz.topics.map((topic) => (
                  <ToggleChip key={topic} size="sm" pressed={topics.includes(topic)} onClick={() => setTopics((p) => toggle(p, topic))}>
                    {stripQuizMarkdown(topic)}
                  </ToggleChip>
                ))}
              </div>
              {presentKinds.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {presentKinds.map((k) => (
                    <ToggleChip key={k} size="sm" pressed={kinds.includes(k)} onClick={() => setKinds((p) => toggle(p, k))}>
                      {t(`quizzes.kind.${k}`)}
                    </ToggleChip>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {PRACTICE_SIZES.map((n) => (
                  <ToggleChip key={n} size="sm" pressed={practiceSize === n} onClick={() => setPracticeSize(n)}>
                    {n}
                  </ToggleChip>
                ))}
              </div>
              <Button size="sm" className="mt-4" disabled={practicePool === 0} onClick={() => onStart('practice', pickPractice(quiz, topics, kinds, practiceSize))}>
                {t('quizzes.home.startPractice', { count: Math.min(practiceSize, practicePool) })}
              </Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-white">{t('quizzes.mode.wrong')}</h2>
              <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.wrongHelp', { count: wrong.length })}</p>
              <Button size="sm" className="mt-4" disabled={wrong.length === 0} onClick={() => onStart('wrong', wrong)}>
                {t('quizzes.home.startWrong')}
              </Button>
            </Card>
          </div>
          <Card>
            <h2 className="font-semibold text-white">{t('quizzes.home.mastery')}</h2>
            <ul className="mt-3 space-y-3">
              {mastery.map((m) => (
                <li key={m.topic} className="text-sm">
                  <div className="flex justify-between text-neutral-300">
                    <span>{stripQuizMarkdown(m.topic)}</span>
                    <span className="tabular-nums text-neutral-500">{t('quizzes.home.masteryCounts', { right: m.right, wrong: m.wrong, total: m.total })}</span>
                  </div>
                  <ProgressBar percent={m.total ? (m.right / m.total) * PERCENT : 0} thickness="sm" label={stripQuizMarkdown(m.topic)} />
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {tab === 'bank' && (
        <>
          <Input aria-label={t('quizzes.bank.search')} placeholder={t('quizzes.bank.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
          {bank.length === 0 ? (
            <EmptyState message={t('quizzes.bank.empty')} />
          ) : (
            <ul className="space-y-3">
              {bank.map((q) => (
                <li key={q.id}>
                  <Card>
                    <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
                      {stripQuizMarkdown(q.topic)} · {t(`quizzes.kind.${q.kind}`)}
                    </p>
                    <div className="space-y-3">
                      <QuestionPrompt question={q} />
                    </div>
                    <details className="mt-3">
                      <summary className="cursor-pointer text-sm text-violet-300">{t('quizzes.bank.reveal')}</summary>
                      <div className="mt-3">
                        <QuestionView question={q} item={answerKeyItem(q)} reveal showVerdict={false} hidePrompt />
                      </div>
                    </details>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'history' &&
        (quiz.attempts.length === 0 ? (
          <EmptyState message={t('quizzes.history.empty')} />
        ) : (
          <ul className="space-y-2">
            {quiz.attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm">
                <span className="text-neutral-200">
                  {t(`quizzes.mode.${a.mode.toLowerCase()}`)}
                  {(a.planned ?? 0) > a.total && (
                    <span className="ml-2 text-xs text-amber-300">{t('quizzes.history.partial', { answered: a.total, planned: a.planned ?? 0 })}</span>
                  )}
                </span>
                <span className="tabular-nums text-neutral-300">
                  {t('quizzes.results.score', { correct: a.correct, total: a.total, percent: Math.round((a.correct / a.total) * PERCENT) })}
                </span>
                <span className="tabular-nums text-neutral-500">{formatElapsed(Math.round(a.durationMs / MS_PER_SECOND))}</span>
                <span className="text-neutral-500">{new Date(a.finishedAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
