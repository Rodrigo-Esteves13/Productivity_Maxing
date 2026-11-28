import TabBar from '../UI/TabBar';
import SegmentedControl from '../UI/SegmentedControl';
import QuizStatsPanel from './QuizStatsPanel';
import QuizWrongArea from './QuizWrongArea';
import QuizSessionCard from './home/QuizSessionCard';
import QuizExamCard from './home/QuizExamCard';
import QuizPracticeCard from './home/QuizPracticeCard';
import QuizWrongCard from './home/QuizWrongCard';
import QuizCalcCard from './home/QuizCalcCard';
import QuizMasteryCard from './home/QuizMasteryCard';
import QuizBankTab from './home/QuizBankTab';
import QuizHistoryTab from './home/QuizHistoryTab';
import { useQuizHome } from './home/useQuizHome';
import type { LastWrongAnswers } from '../../hooks/useQuizSession';
import { makeGenerated } from '../../lib/quizPlay';
import type { GeneratorKind } from '../../lib/quizGenerators';
import { useI18n } from '../../i18n/useI18n';
import type { QuizDetail } from '../../api/quizzesService';
import type { QuizQuestion } from '../../lib/quizFormat';
import { PRACTICE_SIZES, QUESTION_POOLS, type QuizMode, type QuizSession } from '../../lib/quizSession';

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
  onDeleteAttempt: (attemptId: string) => void;
  // Geradores de calculo ligados neste quiz (perguntas feitas pela app).
  generators: GeneratorKind[];
  onSaveGenerators: (next: GeneratorKind[]) => void;
}

// Inicio de um quiz: modos (exame, pratica, erradas), dominio por topico,
// banco de perguntas e historico, como no quiz de exemplo.
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
  onDeleteAttempt,
  generators,
  onSaveGenerators,
}: QuizHomeProps) {
  const { t } = useI18n();
  const home = useQuizHome({ quiz, session, generators, onSaveGenerators });
  const { tab, setTab, wrong } = home;

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
            <QuizSessionCard
              session={session}
              answered={home.answeredInSession}
              onResume={onResume}
              onFinishNow={onFinishNow}
              onDiscard={onDiscard}
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-neutral-400">{t('quizzes.pool.label')}</span>
            <SegmentedControl
              size="sm"
              value={home.pool}
              onChange={home.setPool}
              options={QUESTION_POOLS.map((value) => ({ value, label: t(`quizzes.pool.${value}`, { count: home.poolCounts[value] }) }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <QuizExamCard quiz={quiz} home={home} lastExamIds={lastExamIds} onStart={onStart} />
            <QuizPracticeCard quiz={quiz} home={home} onStart={onStart} />
            <QuizWrongCard wrong={wrong} onStart={onStart} onSeeWrong={() => setTab('wrong')} />
          </div>
          <QuizCalcCard home={home} generators={generators} onStart={onStart} />
          <QuizMasteryCard mastery={home.mastery} />
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

      {tab === 'bank' && <QuizBankTab quiz={quiz} bank={home.bank} search={home.search} onSearchChange={home.setSearch} />}

      {tab === 'history' && (
        <QuizHistoryTab quiz={quiz} points={home.points} onReset={onReset} onDeleteAttempt={onDeleteAttempt} />
      )}
    </div>
  );
}
