import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import ErrorState from '../components/UI/ErrorState';
import QuizErrorBoundary from '../components/Quizzes/QuizErrorBoundary';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import QuizFocusPrompt from '../components/Quizzes/QuizFocusPrompt';
import QuizShareModal from '../components/Quizzes/QuizShareModal';
import QuizDetailActions from '../components/Quizzes/detail/QuizDetailActions';
import QuizRenameModal from '../components/Quizzes/detail/QuizRenameModal';
import QuizDetailBody from '../components/Quizzes/detail/QuizDetailBody';
import { useQuizDetailPage } from '../hooks/useQuizDetailPage';
import { useI18n } from '../i18n/useI18n';
import { QuizFiguresContext } from '../lib/quizFigures';

function QuizDetailContent() {
  const { t } = useI18n();
  const page = useQuizDetailPage();
  const {
    quizId,
    quiz,
    setQuiz,
    title,
    error,
    load,
    view,
    renameDraft,
    setRenameDraft,
    isShareOpen,
    setShareOpen,
    pendingStart,
    setPendingStart,
    study,
  } = page;

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
            <QuizDetailActions
              quiz={quiz}
              onShare={() => setShareOpen(true)}
              onRename={() => setRenameDraft(quiz.title)}
              onDelete={page.requestDelete}
            />
          ) : null
        }
      />
      <QuizRenameModal
        draft={renameDraft}
        isSaving={page.isRenaming}
        onChange={setRenameDraft}
        onSubmit={() => void page.submitRename()}
        onClose={() => setRenameDraft(null)}
      />
      {quiz && !quiz.sharedBy && (
        <QuizShareModal
          quizId={quizId}
          isOpen={isShareOpen}
          onClose={() => setShareOpen(false)}
          onChanged={(isShared) => setQuiz((prev) => prev && { ...prev, isShared })}
        />
      )}
      <QuizFiguresContext.Provider value={page.figures}>
        <QuizDetailBody page={page} />
      </QuizFiguresContext.Provider>
      <ConfirmActionDialog state={page.confirm} />
      <ConfirmActionDialog state={page.resetConfirm} />
      {pendingStart && quiz && (
        <QuizFocusPrompt
          isOpen
          link={{ areaId: quiz.areaId ?? null, taskId: quiz.taskId ?? null }}
          isStarting={study.isSubmitting}
          onStartWithFocus={(link, neverAsk) => void page.startWithFocus(link, neverAsk)}
          onQuizOnly={page.quizOnly}
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
