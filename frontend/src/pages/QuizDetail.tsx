import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import Button from '../components/UI/Button';
import Input from '../components/UI/Input';
import Modal from '../components/UI/Modal';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import QuizHome from '../components/Quizzes/QuizHome';
import QuizRunner from '../components/Quizzes/QuizRunner';
import QuizResults from '../components/Quizzes/QuizResults';
import QuizErrorBoundary from '../components/Quizzes/QuizErrorBoundary';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import {
  clearQuizAttempts,
  deleteQuiz,
  dismissQuizWrong,
  getQuiz,
  renameQuiz,
  resetQuizStats,
  submitQuizAttempt,
  updateQuizGenerators,
  updateQuizLinks,
  type QuizDetail as QuizData,
} from '../api/quizzesService';
import { createFlashcards } from '../api/flashcardsService';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useQuizCardsSent, useQuizFocusPrefs, useQuizLastExam, useQuizLastWrong, useQuizSession } from '../hooks/useQuizSession';
import { useActiveStudySession } from '../context/useActiveStudySession';
import QuizFocusPrompt from '../components/Quizzes/QuizFocusPrompt';
import QuizStudyLink from '../components/Quizzes/QuizStudyLink';
import QuizShareModal from '../components/Quizzes/QuizShareModal';
import type { QuizLinkValue } from '../components/Quizzes/QuizLinkPickers';
import { useFeedback } from '../context/useFeedback';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import { chunkCards } from '../lib/flashcardImport';
import { stripQuizMarkdown } from '../lib/quizMarkdown';
import type { Quiz, QuizQuestion } from '../lib/quizFormat';
import { QUIZ_TITLE_MAX } from '../lib/quizFormat';
import { QuizFiguresContext } from '../lib/quizFigures';
import { enabledKinds, withGenerated } from '../lib/quizPlay';
import { parseGeneratedId, statKeyOf, type GeneratorKind } from '../lib/quizGenerators';
import {
  answeredOnly,
  classifyAttempt,
  MS_PER_SECOND,
  QUIZ_MIN_ATTEMPT_MS,
  quizQuestionsToCards,
  scoreSession,
  sessionFitsQuiz,
  startSession,
  touchSession,
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
function judgeAttempt(quiz: Quiz, session: QuizSession, now: number, countBlanks = false) {
  try {
    // O tempo ate agora vai para a pergunta aberta antes de corrigir.
    const touched = touchSession(session, now);
    const verdict = classifyAttempt(quiz, touched, now, countBlanks);
    const done = { ...touched, finishedAt: now, activeMs: verdict.activeMs };
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
  // ?share=1 (Social > As minhas partilhas) abre logo a partilha.
  const [searchParams, setSearchParams] = useSearchParams();
  const isShareOpen = searchParams.get('share') === '1';
  const setShareOpen = (open: boolean) => setSearchParams(open ? { share: '1' } : {}, { replace: true });
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [error, setError] = useState(false);
  const { session: storedSession, setSession, clear } = useQuizSession(quizId);
  const { sent, markSent } = useQuizCardsSent(quizId);
  const lastWrong = useQuizLastWrong(quizId);
  const lastExam = useQuizLastExam(quizId);
  const focusPrefs = useQuizFocusPrefs(quizId);
  const study = useActiveStudySession();
  // Tentativa a espera da resposta do aviso de foco.
  const [pendingStart, setPendingStart] = useState<{ mode: QuizMode; picked: QuizQuestion[] } | null>(null);
  const [view, setView] = useState<View>('home');
  const [finished, setFinished] = useState<FinishedAttempt | null>(null);
  const [isSendingCards, setIsSendingCards] = useState(false);
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const confirm = useConfirmAction(t('quizzes.deleteError'));
  const resetConfirm = useConfirmAction(t('quizzes.reset.error'));
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

  // Geradores ligados e o quiz "jogavel": o guardado mais as perguntas geradas
  // da tentativa em curso ou acabada (refeitas a partir dos ids).
  const kinds = useMemo(() => enabledKinds(quiz?.generators), [quiz]);
  const playQuiz = useMemo(() => {
    if (!quiz) return null;
    const ids = [...(storedSession?.items ?? []), ...(finished?.session.items ?? [])].map((it) => it.id);
    return withGenerated(quiz, ids, kinds, t);
  }, [quiz, storedSession, finished, kinds, t]);

  // Sessao guardada que nao bate certo com este quiz (ids ou indices) e descartada.
  const session = useMemo(
    () => (playQuiz && storedSession && sessionFitsQuiz(storedSession, playQuiz) ? storedSession : null),
    [playQuiz, storedSession],
  );
  useEffect(() => {
    if (quiz && storedSession && !session) clear();
  }, [quiz, storedSession, session, clear]);

  const questions = useMemo(() => new Map((playQuiz?.questions ?? []).map((q) => [q.id, q])), [playQuiz]);
  // Quizzes gravados antes das figuras nao trazem o campo.
  const figures = useMemo(() => playQuiz?.figures ?? {}, [playQuiz]);
  const score = useMemo(() => (playQuiz && finished ? scoreSession(playQuiz, finished.session) : null), [playQuiz, finished]);
  // So as erradas que ainda nao foram para as flashcards.
  const unsentWrong = useMemo(() => {
    const already = new Set(sent);
    return (score?.results ?? []).filter((r) => !r.right && !already.has(r.question.id)).map((r) => r.question);
  }, [score, sent]);

  // Fazer um quiz e estudar: sem sessao de foco ativa, pergunta primeiro se
  // quer contar o tempo para a cadeira/task (salvo "nao perguntar mais").
  const start = (mode: QuizMode, picked: QuizQuestion[]) => {
    if (!quiz || picked.length === 0) return;
    if (!study.activeSession && !focusPrefs.optedOut) {
      setPendingStart({ mode, picked });
      return;
    }
    beginAttempt(mode, picked);
  };

  const beginAttempt = (mode: QuizMode, picked: QuizQuestion[]) => {
    if (!quiz || picked.length === 0) return;
    if (mode === 'exam') lastExam.remember(picked.map((q) => q.id).filter((id) => !parseGeneratedId(id)));
    setSession(startSession(mode, picked, quiz.secondsPerQuestion));
    setView('run');
  };

  // A sessao de foco que a tentativa abriu fecha com ela (pede a nota de foco).
  const stopQuizFocus = useCallback(() => {
    if (focusPrefs.sessionId && study.activeSession?.id === focusPrefs.sessionId) void study.stop();
    focusPrefs.setSessionId(null);
  }, [focusPrefs, study]);

  const finish = useCallback(async (countBlanks = false) => {
    if (!quiz || !playQuiz || !session) return;
    const now = Date.now();
    const judged = judgeAttempt(playQuiz, session, now, countBlanks);
    if (!judged) {
      // Sessao estragada: nao deixa uma promessa rejeitada nem a pagina presa.
      clear();
      stopQuizFocus();
      setView('home');
      notify(t('common.error.title'), 'error');
      return;
    }
    const { verdict, done, counted, result } = judged;
    clear();
    stopQuizFocus();
    if (verdict.outcome === 'discard') {
      setView('home');
      notify(t('quizzes.run.discarded', { seconds: QUIZ_MIN_ATTEMPT_MS / MS_PER_SECOND }), 'info');
      return;
    }
    setFinished({ session: counted, planned: verdict.planned });
    setView('results');
    // Geradas nao entram na area de erradas (cada uma e unica); contam por tipo nas estatisticas.
    lastWrong.record(
      result.results.filter((r) => !parseGeneratedId(r.question.id)).map((r) => ({ id: r.question.id, response: r.item.response, right: r.right })),
    );
    try {
      const saved = await submitQuizAttempt(
        quiz.id,
        done.mode,
        verdict.activeMs,
        result.results.map((r) => ({ questionId: statKeyOf(r.question.id), correct: r.right, timeMs: Math.round(r.item.timeMs) })),
        verdict.planned,
      );
      setQuiz((prev) => prev && { ...prev, stats: saved.stats, lastScorePct: saved.lastScorePct, attempts: [saved.attempt, ...prev.attempts] });
    } catch {
      notify(t('quizzes.results.saveError'), 'error');
    }
  }, [quiz, playQuiz, session, clear, notify, t, lastWrong, stopQuizFocus]);

  const startWithFocus = async (link: QuizLinkValue, neverAsk: boolean) => {
    const pending = pendingStart;
    if (!pending) return;
    if (neverAsk) focusPrefs.setOptedOut(true);
    const ok = await study.start({ areaId: link.areaId ?? undefined, taskId: link.taskId ?? undefined });
    setPendingStart(null);
    beginAttempt(pending.mode, pending.picked);
    if (ok) focusPrefs.setSessionId('pending');
  };

  const quizOnly = (neverAsk: boolean) => {
    const pending = pendingStart;
    if (neverAsk) focusPrefs.setOptedOut(true);
    setPendingStart(null);
    if (pending) beginAttempt(pending.mode, pending.picked);
  };

  // O id da sessao so se sabe depois do start: liga a sessao nova a tentativa.
  useEffect(() => {
    if (focusPrefs.sessionId === 'pending' && study.activeSession) focusPrefs.setSessionId(study.activeSession.id);
  }, [focusPrefs, study.activeSession]);

  const saveLinks = async (link: QuizLinkValue) => {
    try {
      await updateQuizLinks(quizId, link);
      setQuiz(await getQuiz(quizId));
    } catch {
      notify(t('quizzes.link.saveError'), 'error');
    }
  };

  const saveGenerators = async (next: GeneratorKind[]) => {
    try {
      await updateQuizGenerators(quizId, next);
      setQuiz((prev) => prev && { ...prev, generators: next });
    } catch {
      notify(t('quizzes.calc.saveError'), 'error');
    }
  };

  // Limpezas do historico e das estatisticas: confirmadas, depois recarrega o quiz.
  const requestReset = (kind: 'history' | 'stats' | 'wrong') =>
    resetConfirm.request({
      title: t(`quizzes.reset.${kind}.title`),
      message: t(`quizzes.reset.${kind}.message`),
      confirmLabel: t(`quizzes.reset.${kind}.confirm`),
      tone: 'danger',
      run: async () => {
        if (kind === 'history') await clearQuizAttempts(quizId);
        else if (kind === 'stats') await resetQuizStats(quizId);
        else await dismissQuizWrong(quizId);
        if (kind !== 'history') lastWrong.forget('all');
        setQuiz(await getQuiz(quizId));
      },
    });

  const dismissWrong = async (questionId: string) => {
    try {
      await dismissQuizWrong(quizId, questionId);
      lastWrong.forget([questionId]);
      setQuiz(await getQuiz(quizId));
    } catch {
      notify(t('quizzes.wrongArea.removeError'), 'error');
    }
  };

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

  const submitRename = async () => {
    const next = (renameDraft ?? '').trim();
    if (!next || isRenaming) return;
    if (quiz && next === quiz.title) {
      setRenameDraft(null);
      return;
    }
    setIsRenaming(true);
    try {
      await renameQuiz(quizId, next);
      setQuiz((prev) => prev && { ...prev, title: next });
      setRenameDraft(null);
      notify(t('quickWins.quizRenamed'), 'success');
    } catch {
      notify(t('quickWins.quizRenameError'), 'error');
    } finally {
      setIsRenaming(false);
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
        <Breadcrumbs items={[{ label: t('nav.quizzes'), to: '/quizzes' }, { label: t('quizzes.title') }]} />
        <ErrorState message={t('quizzes.loadError')} onRetry={load} />
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <Breadcrumbs items={[{ label: t('nav.quizzes'), to: '/quizzes' }, { label: quiz ? title : t('common.loading') }]} />
      <PageHeader
        title={title}
        description={
          quiz
            ? `${t('quizzes.card.questions', { count: quiz.questionCount })} · ${quiz.sharedBy ? t('quizzes.shared.by', { name: quiz.sharedBy.name || t('quizzes.share.unnamed') }) : t('quizzes.aiLabel')}`
            : undefined
        }
        action={
          view === 'home' && quiz ? (
            <div className="flex flex-wrap gap-2">
              {/* So o autor partilha; uma copia recebida nao volta a sair. */}
              {!quiz.sharedBy && (
                <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
                  {quiz.isShared ? t('quizzes.share.buttonActive') : t('quizzes.share.button')}
                </Button>
              )}
              <Button variant="secondary" size="sm" onClick={() => setRenameDraft(quiz.title)}>
                {t('quickWins.quizRename')}
              </Button>
              <Button variant="secondary" size="sm" onClick={requestDelete}>
                {t('quizzes.delete')}
              </Button>
            </div>
          ) : null
        }
      />
      <Modal isOpen={renameDraft !== null} onClose={() => setRenameDraft(null)} title={t('quickWins.quizRenameTitle')}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submitRename();
          }}
        >
          <Input
            label={t('quickWins.quizRenameLabel')}
            value={renameDraft ?? ''}
            maxLength={QUIZ_TITLE_MAX}
            onChange={(e) => setRenameDraft(e.target.value)}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRenameDraft(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isRenaming || !(renameDraft ?? '').trim()}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>
      {quiz && !quiz.sharedBy && (
        <QuizShareModal
          quizId={quizId}
          isOpen={isShareOpen}
          onClose={() => setShareOpen(false)}
          onChanged={(isShared) => setQuiz((prev) => prev && { ...prev, isShared })}
        />
      )}
      <QuizFiguresContext.Provider value={figures}>
        {!quiz ? (
          <CardGridSkeleton cards={3} />
        ) : view === 'run' && session ? (
          <QuizRunner questions={questions} session={session} onChange={setSession} onFinish={(countBlanks) => void finish(countBlanks)} />
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
          <>
          <div className="mb-4">
            <QuizStudyLink
              areaName={quiz.area?.name ?? null}
              taskTitle={quiz.task?.title ?? null}
              link={{ areaId: quiz.areaId ?? null, taskId: quiz.taskId ?? null }}
              onSave={(link) => void saveLinks(link)}
            />
          </div>
          <QuizHome
            quiz={quiz}
            session={session}
            onStart={start}
            onResume={() => setView('run')}
            onFinishNow={() => void finish()}
            onDiscard={() =>
              resetConfirm.request({
                title: t('confirmGuard.discardAttempt.title'),
                message: t('confirmGuard.discardAttempt.message'),
                confirmLabel: t('confirmGuard.discardAttempt.confirm'),
                tone: 'danger',
                run: async () => {
                  clear();
                  stopQuizFocus();
                },
              })
            }
            lastWrongAnswers={lastWrong.answers}
            lastExamIds={lastExam.ids}
            onReset={requestReset}
            onDismissWrong={(id) => void dismissWrong(id)}
            generators={kinds}
            onSaveGenerators={(next) => void saveGenerators(next)}
          />
          </>
        )}
      </QuizFiguresContext.Provider>
      <ConfirmActionDialog state={confirm} />
      <ConfirmActionDialog state={resetConfirm} />
      {pendingStart && quiz && (
        <QuizFocusPrompt
          isOpen
          link={{ areaId: quiz.areaId ?? null, taskId: quiz.taskId ?? null }}
          isStarting={study.isSubmitting}
          onStartWithFocus={(link, neverAsk) => void startWithFocus(link, neverAsk)}
          onQuizOnly={quizOnly}
          onCancel={() => setPendingStart(null)}
        />
      )}
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
