import { useMemo, useState } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import Input from '../UI/Input';
import ProgressBar from '../UI/ProgressBar';
import TabBar from '../UI/TabBar';
import ToggleChip from '../UI/ToggleChip';
import ToggleRow from '../UI/ToggleRow';
import SegmentedControl from '../UI/SegmentedControl';
import QuestionView, { QuestionPrompt } from './QuestionView';
import QuizStatsPanel from './QuizStatsPanel';
import QuizWrongArea from './QuizWrongArea';
import QuizEvolutionChart from './QuizEvolutionChart';
import type { LastWrongAnswers } from '../../hooks/useQuizSession';
import { BAND_FILL, BAND_TEXT, evolution, scoreBand } from '../../lib/quizInsights';
import { CALC_SIZES, generatedShare, makeGenerated } from '../../lib/quizPlay';
import { GENERATOR_KINDS, type GeneratorKind } from '../../lib/quizGenerators';
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
  poolQuestions,
  PRACTICE_SIZES,
  QUESTION_POOLS,
  shuffle,
  statOf,
  timesWrong,
  topicMastery,
  wasAnswered,
  wrongQuestions,
  type QuestionPool,
  type QuizMode,
  type QuizSession,
} from '../../lib/quizSession';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { foldText } from '../../lib/textSearch';

type HomeTab = 'modes' | 'wrong' | 'stats' | 'bank' | 'history';
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
  // Ultima resposta errada de cada pergunta (neste dispositivo).
  lastWrongAnswers: LastWrongAnswers;
  // Perguntas do ultimo exame: o proximo evita repeti-las.
  lastExamIds: string[];
  onReset: (kind: 'history' | 'stats' | 'wrong') => void;
  onDismissWrong: (questionId: string) => void;
  // Geradores de calculo ligados neste quiz (perguntas feitas pela app).
  generators: GeneratorKind[];
  onSaveGenerators: (next: GeneratorKind[]) => void;
}

// Inicio de um quiz: modos (exame, pratica, erradas), dominio por topico,
// banco de perguntas e historico, como no quiz de exemplo.
// Historico: modo | nota com barra | tempo | data (no telemovel, 2 por linha).
const HISTORY_ROW =
  'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_4.5rem_minmax(0,11rem)]';
const DATE_FORMAT: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };

export default function QuizHome({
  quiz,
  session,
  onStart,
  onResume,
  onFinishNow,
  onDiscard,
  lastWrongAnswers,
  lastExamIds,
  onReset,
  onDismissWrong,
  generators,
  onSaveGenerators,
}: QuizHomeProps) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<HomeTab>('modes');
  const [examSize, setExamSize] = useState<number>(EXAM_SIZES[0]);
  const [topics, setTopics] = useState<string[]>([]);
  const [kinds, setKinds] = useState<QuizKind[]>([]);
  const [practiceSize, setPracticeSize] = useState<number>(PRACTICE_SIZES[0]);
  const [search, setSearch] = useState('');
  const [weakFirst, setWeakFirst] = useState(false);
  // De onde o exame e a pratica escolhem: todas, nunca vistas, erradas ou as duas.
  const [pool, setPool] = useState<QuestionPool>('all');
  const poolCounts = useMemo(
    () => Object.fromEntries(QUESTION_POOLS.map((p) => [p, poolQuestions(quiz, quiz.stats, p).length])) as Record<QuestionPool, number>,
    [quiz],
  );
  const poolQuiz = useMemo(() => ({ ...quiz, questions: poolQuestions(quiz, quiz.stats, pool) }), [quiz, pool]);
  const poolSize = poolQuiz.questions.length;
  const [mixGenerated, setMixGenerated] = useState(true);
  const [calcKinds, setCalcKinds] = useState<GeneratorKind[]>([]);
  const [calcSize, setCalcSize] = useState<number>(CALC_SIZES[0]);
  const hasGenerators = generators.length > 0;
  const mixing = hasGenerators && mixGenerated;
  // Junta ~25% de perguntas geradas a uma escolha do banco (se ligado).
  const withMix = (size: number, pick: (n: number) => QuizQuestion[]) => {
    if (!mixing) return pick(size);
    const g = generatedShare(size);
    return shuffle([...pick(size - g), ...makeGenerated(generators, g, t)]);
  };
  const calcChosen = calcKinds.filter((k) => generators.includes(k));
  const toggleGenerator = (kind: GeneratorKind) =>
    onSaveGenerators(GENERATOR_KINDS.filter((k) => (k === kind ? !generators.includes(k) : generators.includes(k))));
  const points = useMemo(() => evolution(quiz.attempts), [quiz.attempts]);

  const presentKinds = useMemo(() => QUIZ_KINDS.filter((k) => quiz.questions.some((q) => q.kind === k)), [quiz.questions]);
  const wrong = useMemo(() => wrongQuestions(quiz, quiz.stats), [quiz]);
  const mastery = useMemo(() => topicMastery(quiz, quiz.stats), [quiz]);
  const practicePool = pickPractice(poolQuiz, topics, kinds, poolSize).length;
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
  const examSizes = EXAM_SIZES.filter((n) => n < poolSize);
  const examCount = Math.min(examSize, poolSize);

  return (
    <div className="space-y-4">
      <TabBar
        label={t('quizzes.home.tabs')}
        value={tab}
        onChange={setTab}
        items={[
          { value: 'modes', label: t('quizzes.home.modes') },
          { value: 'wrong', label: t('quizzes.mode.wrong'), count: wrong.length },
          { value: 'stats', label: t('quizzes.home.stats') },
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
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-400">{t('quizzes.pool.label')}</span>
            <SegmentedControl
              size="sm"
              value={pool}
              onChange={setPool}
              options={QUESTION_POOLS.map((value) => ({ value, label: t(`quizzes.pool.${value}`, { count: poolCounts[value] }) }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <h2 className="font-semibold text-white">{t('quizzes.mode.exam')}</h2>
              <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.examHelp', { seconds: quiz.secondsPerQuestion })}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[...examSizes, poolSize].filter((n) => n > 0).map((n) => (
                  <ToggleChip key={n} size="sm" pressed={examCount === n} onClick={() => setExamSize(n)}>
                    {t('quizzes.home.examSize', { count: n, minutes: Math.ceil((n * quiz.secondsPerQuestion) / SECONDS_PER_MINUTE) })}
                  </ToggleChip>
                ))}
              </div>
              <div className="mt-3">
                <ToggleRow
                  variant="inline"
                  label={t('quizzes.home.weakFirst')}
                  description={t('quizzes.home.weakFirstHelp')}
                  checked={weakFirst}
                  onChange={setWeakFirst}
                />
              </div>
              <Button
                size="sm"
                className="mt-4"
                onClick={() =>
                  onStart('exam', withMix(examCount, (n) => pickExam(poolQuiz, n, Math.random, { weak: weakFirst, stats: quiz.stats, avoid: lastExamIds })))
                }
              >
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
              {hasGenerators && (
                <div className="mt-3">
                  <ToggleRow
                    variant="inline"
                    label={t('quizzes.calc.mix')}
                    description={t('quizzes.calc.mixHelp')}
                    checked={mixGenerated}
                    onChange={setMixGenerated}
                  />
                </div>
              )}
              <Button
                size="sm"
                className="mt-4"
                disabled={practicePool === 0}
                onClick={() => onStart('practice', withMix(practiceSize, (n) => pickPractice(poolQuiz, topics, kinds, n)))}
              >
                {t('quizzes.home.startPractice', { count: Math.min(practiceSize, practicePool) })}
              </Button>
            </Card>
            <Card>
              <h2 className="font-semibold text-white">{t('quizzes.mode.wrong')}</h2>
              <p className="mt-1 text-sm text-neutral-400">{t('quizzes.home.wrongHelp', { count: wrong.length })}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" disabled={wrong.length === 0} onClick={() => onStart('wrong', wrong)}>
                  {t('quizzes.home.startWrong')}
                </Button>
                <Button size="sm" variant="secondary" disabled={wrong.length === 0} onClick={() => setTab('wrong')}>
                  {t('quizzes.home.seeWrong')}
                </Button>
              </div>
            </Card>
          </div>
          <Card>
            <h2 className="font-semibold text-white">{t('quizzes.calc.title')}</h2>
            <p className="mt-1 text-sm text-neutral-400">{hasGenerators ? t('quizzes.calc.help') : t('quizzes.calc.empty')}</p>
            {hasGenerators && (
              <>
                <div className="mt-3 flex flex-wrap gap-2">
                  {generators.map((kind) => (
                    <ToggleChip
                      key={kind}
                      size="sm"
                      pressed={calcChosen.includes(kind)}
                      title={t(`quizGen.${kind}.desc`)}
                      onClick={() => setCalcKinds((p) => toggle(p, kind))}
                    >
                      {t(`quizGen.${kind}.name`)}
                    </ToggleChip>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CALC_SIZES.map((n) => (
                    <ToggleChip key={n} size="sm" pressed={calcSize === n} onClick={() => setCalcSize(n)}>
                      {n}
                    </ToggleChip>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => onStart('practice', makeGenerated(calcChosen.length ? calcChosen : generators, calcSize, t))}
                >
                  {t('quizzes.calc.start', { count: calcSize })}
                </Button>
              </>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-violet-300">{t('quizzes.calc.manage')}</summary>
              <p className="mt-2 text-xs text-neutral-400">{t('quizzes.calc.manageHelp')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENERATOR_KINDS.map((kind) => (
                  <ToggleChip key={kind} size="sm" pressed={generators.includes(kind)} title={t(`quizGen.${kind}.desc`)} onClick={() => toggleGenerator(kind)}>
                    {t(`quizGen.${kind}.name`)}
                  </ToggleChip>
                ))}
              </div>
            </details>
          </Card>
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

      {tab === 'wrong' && (
        <QuizWrongArea
          quiz={quiz}
          wrong={wrong}
          lastWrongAnswers={lastWrongAnswers}
          onPractise={(list) => onStart('wrong', list)}
          onDismiss={onDismissWrong}
          onClearAll={() => onReset('wrong')}
        />
      )}

      {tab === 'stats' && (
        <QuizStatsPanel
          quiz={quiz}
          wrongNow={wrong.length}
          generators={generators}
          onPractise={(list) => onStart('practice', list)}
          onPractiseGenerator={(kind) => onStart('practice', makeGenerated([kind], PRACTICE_SIZES[0], t))}
        />
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
                    {statOf(quiz.stats, q.id) && (
                      <p className="mb-2 text-xs text-neutral-500">
                        {t('quizzes.bank.statLine', { seen: statOf(quiz.stats, q.id)?.seen ?? 0, right: statOf(quiz.stats, q.id)?.correct ?? 0, wrong: timesWrong(statOf(quiz.stats, q.id)) })}
                      </p>
                    )}
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

      {tab === 'history' && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" disabled={quiz.attempts.length === 0} onClick={() => onReset('history')}>
            {t('quizzes.reset.history.button')}
          </Button>
          <Button size="sm" variant="secondary" disabled={Object.keys(quiz.stats).length === 0} onClick={() => onReset('stats')}>
            {t('quizzes.reset.stats.button')}
          </Button>
        </div>
      )}
      {tab === 'history' && quiz.attempts.length > 0 && (
        <Card>
          <h2 className="font-semibold text-white">{t('quizzes.stats.evolution', { count: points.length })}</h2>
          <div className="mt-3">
            <QuizEvolutionChart points={points} />
          </div>
        </Card>
      )}
      {tab === 'history' &&
        (quiz.attempts.length === 0 ? (
          <EmptyState message={t('quizzes.history.empty')} />
        ) : (
          <ul className="space-y-2">
            {quiz.attempts.map((a) => {
              const percent = Math.round((a.correct / a.total) * PERCENT);
              const isPartial = (a.planned ?? 0) > a.total;
              return (
                // Grelha com colunas fixas: tudo alinhado de linha para linha.
                <li key={a.id} className={HISTORY_ROW}>
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="font-medium text-neutral-100">{t(`quizzes.mode.${a.mode.toLowerCase()}`)}</span>
                    {isPartial && (
                      <span className="rounded-md border border-amber-400/40 bg-amber-950/30 px-1.5 py-0.5 text-xs text-amber-300">
                        {t('quizzes.history.partial', { answered: a.total, planned: a.planned ?? 0 })}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 justify-self-end sm:justify-self-stretch">
                    <p className={`tabular-nums ${BAND_TEXT[scoreBand(percent)]}`}>{t('quizzes.results.score', { correct: a.correct, total: a.total, percent })}</p>
                    <ProgressBar percent={percent} thickness="sm" fillClassName={BAND_FILL[scoreBand(percent)]} label={t('quizzes.history.scoreBar', { percent })} className="mt-1 hidden sm:block" />
                  </div>
                  <span className="tabular-nums text-neutral-400 sm:text-right">{formatElapsed(Math.round(a.durationMs / MS_PER_SECOND))}</span>
                  <span className="justify-self-end tabular-nums text-neutral-400">{new Date(a.finishedAt).toLocaleString(lang, DATE_FORMAT)}</span>
                </li>
              );
            })}
          </ul>
        ))}
    </div>
  );
}
