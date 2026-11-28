import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  clearQuizAttempts,
  deleteQuizAttempt,
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
import { useActiveStudySession } from '../context/useActiveStudySession';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';
import { chunkCards } from '../lib/flashcardImport';
import { stripQuizMarkdown } from '../lib/quizMarkdown';
import type { QuizQuestion } from '../lib/quizFormat';
import { enabledKinds, withGenerated } from '../lib/quizPlay';
import { parseGeneratedId, statKeyOf, type GeneratorKind } from '../lib/quizGenerators';
import { judgeAttempt } from '../lib/quizAttempt';
import {
  MS_PER_SECOND,
  QUIZ_MIN_ATTEMPT_MS,
  quizQuestionsToCards,
  scoreSession,
  sessionFitsQuiz,
  startSession,
  type QuizMode,
  type QuizSession,
} from '../lib/quizSession';
import type { QuizLinkValue } from '../components/Quizzes/QuizLinkPickers';
import { useConfirmAction } from './useConfirmAction';
import useDocumentTitle from './useDocumentTitle';
import { useQuizCardsSent, useQuizFocusPrefs, useQuizLastExam, useQuizLastWrong, useQuizSession } from './useQuizSession';

type View = 'home' | 'run' | 'results';

// Tentativa guardada no ecra de resultados: so as respondidas, mais o que estava planeado.
interface FinishedAttempt {
  session: QuizSession;
  planned: number;
}

// Estado e acoes da pagina de um quiz: carregar, fazer a tentativa e gerir.
export function useQuizDetailPage() {
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

  const requestDeleteAttempt = (attemptId: string) =>
    resetConfirm.request({
      title: t('ux4global.attempt.confirmTitle'),
      message: t('ux4global.attempt.confirmMessage'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await deleteQuizAttempt(quizId, attemptId);
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

  const requestDiscard = () =>
    resetConfirm.request({
      title: t('confirmGuard.discardAttempt.title'),
      message: t('confirmGuard.discardAttempt.message'),
      confirmLabel: t('confirmGuard.discardAttempt.confirm'),
      tone: 'danger',
      run: async () => {
        clear();
        stopQuizFocus();
      },
    });

  return {
    quizId,
    quiz,
    setQuiz,
    title,
    error,
    load,
    isShareOpen,
    setShareOpen,
    view,
    setView,
    session,
    setSession,
    finished,
    questions,
    figures,
    score,
    unsentWrong,
    kinds,
    study,
    pendingStart,
    setPendingStart,
    isSendingCards,
    renameDraft,
    setRenameDraft,
    isRenaming,
    confirm,
    resetConfirm,
    lastWrongAnswers: lastWrong.answers,
    lastExamIds: lastExam.ids,
    start,
    finish,
    startWithFocus,
    quizOnly,
    saveLinks,
    saveGenerators,
    requestReset,
    requestDeleteAttempt,
    requestDiscard,
    dismissWrong,
    sendToFlashcards,
    submitRename,
    requestDelete,
  };
}

export type QuizDetailState = ReturnType<typeof useQuizDetailPage>;
