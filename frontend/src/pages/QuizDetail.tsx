import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import QuizHome from '../components/Quizzes/QuizHome';
import QuizRunner from '../components/Quizzes/QuizRunner';
import QuizResults from '../components/Quizzes/QuizResults';
import QuizErrorBoundary from '../components/Quizzes/QuizErrorBoundary';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { deleteQuiz, getQuiz, submitQuizAttempt, type QuizDetail as QuizData } from '../api/quizzesService';
import { createFlashcards } from '../api/flashcardsService';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useQuizCardsSent, useQuizSession } from '../hooks/useQuizSession';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { chunkCards } from '../lib/flashcardImport';
import { stripQuizMarkdown } from '../lib/quizMarkdown';
import type { QuizQuestion } from '../lib/quizFormat';
import { QuizFiguresContext } from '../lib/quizFigures';
import {
  answeredOnly,
  classifyAttempt,
  MS_PER_SECOND,
  QUIZ_MIN_ATTEMPT_MS,
  quizQuestionsToCards,
  scoreSession,
  sessionFitsQuiz,
  startSession,
  type QuizMode,
  type QuizSession,
} from '../lib/quizSession';

type View = 'home' | 'run' | 'results';

// Tentativa guardada no ecra de resultados: so as respondidas, mais o que estava planeado.
interface FinishedAttempt {
  session: QuizSession;
  planned: number;
}

// Corrige a tentativa; null se a sessao guardada rebentar a correcao.
function judgeAttempt(quiz: QuizData, session: QuizSession, now: number) {
  try {
    const verdict = classifyAttempt(quiz, session, now);
    const done = { ...session, finishedAt: now, activeMs: verdict.activeMs };
    const counted = verdict.outcome === 'partial' ? answeredOnly(done, verdict.answeredIds) : done;
    return { verdict, done, counted, result: scoreSession(quiz, counted) };
  } catch {
    return null;
  }
}

function QuizDetailContent() {
  const { t } = useI18n();
  const { quizId = '' } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const { notify } = useFeedback();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState(false);
  const { session: storedSession, setSession, clear } = useQuizSession(quizId);
  const { sent, markSent } = useQuizCardsSent(quizId);
  const [view, setView] = useState<View>('home');
  const [finished, setFinished] = useState<FinishedAttempt | null>(null);
  const [isSendingCards, setIsSendingCards] = useState(false);
  const confirm = useConfirmAction(t('quizzes.deleteError'));
  // Titulo de uma linha: o ficheiro pode trazer **marcas** (de <b>) que aqui nao se desenham.
  const title = quiz ? stripQuizMarkdown(quiz.title) : t('quizzes.title');
  useDocumentTitle(title);

  const load = useCallback(() => {
    setError(false);
    getQuiz(quizId)
      .then(setQuiz)
      .catch(() => setError(true));
  }, [quizId]);
  useEffect(load, [load]);

  // Sessao guardada que nao bate certo com este quiz (ids ou indices) e descartada.
  const session = useMemo(() => (quiz && storedSession && sessionFitsQuiz(storedSession, quiz) ? storedSession : null), [quiz, storedSession]);
  useEffect(() => {
    if (quiz && storedSession && !session) clear();
  }, [quiz, storedSession, session, clear]);

  const questions = useMemo(() => new Map((quiz?.questions ?? []).map((q) => [q.id, q])), [quiz]);
  // Quizzes gravados antes das figuras nao trazem o campo.
  const figures = useMemo(() => quiz?.figures ?? {}, [quiz]);
  const score = useMemo(() => (quiz && finished ? scoreSession(quiz, finished.session) : null), [quiz, finished]);
  // So as erradas que ainda nao foram para as flashcards.
  const unsentWrong = useMemo(() => {
    const already = new Set(sent);
    return (score?.results ?? []).filter((r) => !r.right && !already.has(r.question.id)).map((r) => r.question);
  }, [score, sent]);

  const start = (mode: QuizMode, picked: QuizQuestion[]) => {
    if (!quiz || picked.length === 0) return;
    setSession(startSession(mode, picked, quiz.secondsPerQuestion));
    setView('run');
  };

  const finish = useCallback(async () => {
    if (!quiz || !session) return;
    const now = Date.now();
    const judged = judgeAttempt(quiz, session, now);
    if (!judged) {
      // Sessao estragada: nao deixa uma promessa rejeitada nem a pagina presa.
      clear();
      setView('home');
      notify(t('common.error.title'), 'error');
      return;
    }
    const { verdict, done, counted, result } = judged;
    clear();
    if (verdict.outcome === 'discard') {
      setView('home');
      notify(t('quizzes.run.discarded', { seconds: QUIZ_MIN_ATTEMPT_MS / MS_PER_SECOND }), 'info');
      return;
    }
    setFinished({ session: counted, planned: verdict.planned });
    setView('results');
    try {
      const saved = await submitQuizAttempt(
        quiz.id,
        done.mode,
        verdict.activeMs,
        result.results.map((r) => ({ questionId: r.question.id, correct: r.right })),
        verdict.planned,
      );
      setQuiz((prev) => prev && { ...prev, stats: saved.stats, lastScorePct: saved.lastScorePct, attempts: [saved.attempt, ...prev.attempts] });
    } catch {
      notify(t('quizzes.results.saveError'), 'error');
    }
  }, [quiz, session, clear, notify, t]);

  const sendToFlashcards = async () => {
    if (unsentWrong.length === 0) return;
    setIsSendingCards(true);
    try {
      const cards = quizQuestionsToCards(unsentWrong);
      for (const batch of chunkCards(cards.map((c) => ({ ...c, areaId: null })))) await createFlashcards(batch);
      markSent(unsentWrong.map((q) => q.id));
      notify(t('quizzes.results.cardsCreated', { count: cards.length }), 'success');
    } catch {
      notify(t('quizzes.results.cardsError'), 'error');
    } finally {
      setIsSendingCards(false);
    }
  };

  const requestDelete = () =>
    confirm.request({
      title: t('quizzes.delete'),
      message: t('quizzes.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await deleteQuiz(quizId);
        clear();
        navigate('/quizzes');
      },
    });

  if (error) {
    return (
      <PageLayout>
        <ErrorState message={t('quizzes.loadError')} onRetry={load} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={title}
        description={quiz ? `${t('quizzes.card.questions', { count: quiz.questionCount })} · ${t('quizzes.aiLabel')}` : undefined}
        action={
          view === 'home' && quiz ? (
            <Button variant="secondary" size="sm" onClick={requestDelete}>
              {t('quizzes.delete')}
            </Button>
          ) : null
        }
      />
      <QuizFiguresContext.Provider value={figures}>
        {!quiz ? (
          <CardGridSkeleton cards={3} />
        ) : view === 'run' && session ? (
          <QuizRunner questions={questions} session={session} onChange={setSession} onFinish={() => void finish()} />
        ) : view === 'results' && finished && score ? (
          <QuizResults
            session={finished.session}
            planned={finished.planned}
            score={score}
            unsentWrong={unsentWrong.length}
            isSendingCards={isSendingCards}
            onSendToFlashcards={() => void sendToFlashcards()}
            onRetryWrong={() => start('wrong', score.results.filter((r) => !r.right).map((r) => r.question))}
            onHome={() => setView('home')}
          />
        ) : (
          <QuizHome
            quiz={quiz}
            session={session}
            onStart={start}
            onResume={() => setView('run')}
            onFinishNow={() => void finish()}
            onDiscard={clear}
          />
        )}
      </QuizFiguresContext.Provider>
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}

export default function QuizDetail() {
  return (
    <QuizErrorBoundary>
      <QuizDetailContent />
    </QuizErrorBoundary>
  );
}
