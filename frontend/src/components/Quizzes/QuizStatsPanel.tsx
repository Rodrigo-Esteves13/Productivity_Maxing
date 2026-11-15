import { useMemo } from 'react';
import Button from '../UI/Button';
import Card from '../UI/Card';
import EmptyState from '../UI/EmptyState';
import ProgressBar from '../UI/ProgressBar';
import QuizEvolutionChart from './QuizEvolutionChart';
import { useI18n } from '../../i18n/useI18n';
import type { QuizDetail } from '../../api/quizzesService';
import type { QuizQuestion } from '../../lib/quizFormat';
import { stripQuizMarkdown } from '../../lib/quizMarkdown';
import { pickPractice, PRACTICE_SIZES } from '../../lib/quizSession';
import type { GeneratorKind } from '../../lib/quizGenerators';
import {
  BAND_FILL,
  generatorInsights,
  evolution,
  formatMs,
  mostMissedQuestions,
  quizOverview,
  scoreBand,
  slowestQuestions,
  topicInsights,
  weakestTopics,
  type QuestionInsight,
} from '../../lib/quizInsights';

interface QuizStatsPanelProps {
  quiz: QuizDetail;
  wrongNow: number;
  onPractise: (questions: QuizQuestion[]) => void;
  generators: GeneratorKind[];
  onPractiseGenerator: (kind: GeneratorKind) => void;
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <Card>
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
    </Card>
  );
}

function QuestionList({ title, items, render }: { title: string; items: QuestionInsight[]; render: (q: QuestionInsight) => string }) {
  const { t } = useI18n();
  return (
    <Card>
      <h2 className="font-semibold text-white">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">{t('quizzes.stats.notEnough')}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.question.id} className="flex items-start justify-between gap-3 text-sm">
              <span className="line-clamp-2 text-neutral-300">{stripQuizMarkdown(item.question.prompt)}</span>
              <span className="shrink-0 tabular-nums text-neutral-400">{render(item)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// Estatisticas do quiz: numeros gerais, areas a melhorar, perguntas mais
// lentas e mais falhadas, e a evolucao das tentativas.
export default function QuizStatsPanel({ quiz, wrongNow, onPractise, generators, onPractiseGenerator }: QuizStatsPanelProps) {
  const { t } = useI18n();
  const overview = useMemo(() => quizOverview(quiz, quiz.stats, quiz.attempts, wrongNow, generators), [quiz, wrongNow, generators]);
  // Topicos do banco e geradores ligados (cada gerador conta como uma area).
  const insights = useMemo(
    () => [...topicInsights(quiz, quiz.stats), ...generatorInsights(quiz.stats, generators, (kind) => t(`quizGen.${kind}.name`))],
    [quiz, generators, t],
  );
  const weakest = useMemo(() => weakestTopics(insights), [insights]);
  const byNeed = useMemo(() => [...insights].sort((a, b) => b.need - a.need), [insights]);
  const slowest = useMemo(() => slowestQuestions(quiz, quiz.stats), [quiz]);
  const missed = useMemo(() => mostMissedQuestions(quiz, quiz.stats), [quiz]);
  const points = useMemo(() => evolution(quiz.attempts), [quiz.attempts]);
  const pct = (value: number | null) => (value === null ? '-' : `${value}%`);

  if (overview.answers === 0) return <EmptyState message={t('quizzes.stats.empty')} />;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile value={`${overview.seen}/${quiz.questions.length}`} label={t('quizzes.stats.seen')} />
        <Tile value={pct(overview.accuracy)} label={t('quizzes.stats.accuracy', { count: overview.answers })} />
        <Tile value={pct(overview.bestExam)} label={t('quizzes.stats.bestExam', { recent: pct(overview.recentExamAvg) })} />
        <Tile value={formatMs(overview.avgMsPerQuestion)} label={t('quizzes.stats.avgTime')} />
      </div>

      <Card>
        <h2 className="font-semibold text-white">{t('quizzes.stats.improve')}</h2>
        <p className="mt-1 text-sm text-neutral-400">{t('quizzes.stats.improveHelp')}</p>
        {weakest.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-400">{t('quizzes.stats.notEnough')}</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {weakest.map((topic, i) => (
              <li key={topic.topic} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="w-5 font-mono text-xs text-neutral-500">{i + 1}</span>
                <div className="min-w-48 flex-1">
                  <div className="flex justify-between text-neutral-200">
                    <span>{stripQuizMarkdown(topic.topic)}</span>
                    <span className="tabular-nums text-neutral-400">{pct(topic.accuracy)}</span>
                  </div>
                  <ProgressBar percent={topic.accuracy ?? 0} thickness="sm" fillClassName={BAND_FILL[scoreBand(topic.accuracy ?? 0)]} label={stripQuizMarkdown(topic.topic)} />
                  <p className="mt-1 text-xs text-neutral-500">
                    {t('quizzes.stats.topicLine', { wrong: topic.wrongNow, unseen: topic.total - topic.seen, time: formatMs(topic.avgMs) })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => (topic.generator ? onPractiseGenerator(topic.generator) : onPractise(pickPractice(quiz, [topic.topic], [], PRACTICE_SIZES[0])))}
                >
                  {t('quizzes.stats.practise')}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold text-white">{t('quizzes.stats.byTopic')}</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr>
                <th className="py-1 pr-3 font-normal">{t('quizzes.stats.colTopic')}</th>
                <th className="py-1 pr-3 font-normal">{t('quizzes.stats.colAccuracy')}</th>
                <th className="py-1 pr-3 font-normal">{t('quizzes.stats.colSeen')}</th>
                <th className="py-1 pr-3 font-normal">{t('quizzes.stats.colWrong')}</th>
                <th className="py-1 font-normal">{t('quizzes.stats.colTime')}</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-neutral-300">
              {byNeed.map((topic) => (
                <tr key={topic.topic} className="border-t border-neutral-800">
                  <td className="py-1.5 pr-3">{stripQuizMarkdown(topic.topic)}</td>
                  <td className="py-1.5 pr-3">{pct(topic.accuracy)}</td>
                  <td className="py-1.5 pr-3">{topic.generator ? t('quizzes.calc.answers', { count: topic.answers }) : `${topic.seen}/${topic.total}`}</td>
                  <td className="py-1.5 pr-3">{topic.wrongNow}</td>
                  <td className="py-1.5">{formatMs(topic.avgMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <QuestionList title={t('quizzes.stats.slowest')} items={slowest} render={(q) => formatMs(q.avgMs)} />
        <QuestionList title={t('quizzes.stats.mostMissed')} items={missed} render={(q) => t('quizzes.stats.missedTimes', { wrong: q.wrong, seen: q.seen })} />
      </div>

      <Card>
        <h2 className="font-semibold text-white">{t('quizzes.stats.evolution', { count: points.length })}</h2>
        <div className="mt-3">
          <QuizEvolutionChart points={points} />
        </div>
      </Card>
    </div>
  );
}
