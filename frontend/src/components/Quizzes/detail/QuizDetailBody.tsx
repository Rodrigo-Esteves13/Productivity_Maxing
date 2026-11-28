import CardGridSkeleton from '../../UI/CardGridSkeleton';
import QuizHome from '../QuizHome';
import QuizRunner from '../QuizRunner';
import QuizResults from '../QuizResults';
import QuizStudyLink from '../QuizStudyLink';
import type { QuizDetailState } from '../../../hooks/useQuizDetailPage';

// O que esta no ecra: tentativa a decorrer, resultados ou o inicio do quiz.
export default function QuizDetailBody({ page }: { page: QuizDetailState }) {
  const {
    quiz,
    view,
    setView,
    session,
    setSession,
    finished,
    questions,
    score,
    unsentWrong,
    isSendingCards,
    kinds,
    start,
    finish,
  } = page;

  if (!quiz) return <CardGridSkeleton cards={3} />;

  if (view === 'run' && session) {
    return (
      <QuizRunner questions={questions} session={session} onChange={setSession} onFinish={(countBlanks) => void finish(countBlanks)} />
    );
  }

  if (view === 'results' && finished && score) {
    return (
      <QuizResults
        session={finished.session}
        planned={finished.planned}
        score={score}
        unsentWrong={unsentWrong.length}
        isSendingCards={isSendingCards}
        onSendToFlashcards={() => void page.sendToFlashcards()}
        onRetryWrong={() => start('wrong', score.results.filter((r) => !r.right).map((r) => r.question))}
        onHome={() => setView('home')}
      />
    );
  }

  return (
    <>
      <div className="mb-4">
        <QuizStudyLink
          areaName={quiz.area?.name ?? null}
          taskTitle={quiz.task?.title ?? null}
          link={{ areaId: quiz.areaId ?? null, taskId: quiz.taskId ?? null }}
          onSave={(link) => void page.saveLinks(link)}
        />
      </div>
      <QuizHome
        quiz={quiz}
        session={session}
        onStart={start}
        onResume={() => setView('run')}
        onFinishNow={() => void finish()}
        onDiscard={page.requestDiscard}
        lastWrongAnswers={page.lastWrongAnswers}
        lastExamIds={page.lastExamIds}
        onReset={page.requestReset}
        onDismissWrong={(id) => void page.dismissWrong(id)}
        onDeleteAttempt={page.requestDeleteAttempt}
        generators={kinds}
        onSaveGenerators={(next) => void page.saveGenerators(next)}
      />
    </>
  );
}
