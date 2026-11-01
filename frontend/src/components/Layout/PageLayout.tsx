import { lazy, Suspense, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { useAuth } from '../../context/useAuth';
import { useOverdueCheckins } from '../../hooks/useOverdueCheckins';
import AcademicSelectors from './AcademicSelectors';
import SkipToContentLink from '../UI/SkipToContentLink';
import ScrollProgressBar from '../UI/ScrollProgressBar';
import BackToTopButton from '../UI/BackToTopButton';
import PageTrail from './PageTrail';

// Only Dashboard, Tasks and Notebook actually change with the active
// program/period - everywhere else (Focus, Profile, Developer, Agent,
// Areas, admin pages, ...) the Program/Period pickers up top would just
// sit there doing nothing, or worse, look like they filter content that
// isn't actually scoped by them.
// Lazy: so carrega quando ha uma task em atraso para confirmar.
const OverdueCheckinModal = lazy(() => import('../Tasks/OverdueCheckinModal'));

const ROUTES_WITH_ACADEMIC_SELECTORS = ['/dashboard', '/tasks', '/notebook', '/ratings', '/risk'];

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated, user } = useAuth();
  const { pathname } = useLocation();
  const showAcademicSelectors =
    isAuthenticated && ROUTES_WITH_ACADEMIC_SELECTORS.includes(pathname);

  // Fica aqui (em vez de em cada página individual) precisamente porque
  // o PageLayout é o único ponto comum a todas as páginas autenticadas -
  // garante que o check-in de tasks fora de prazo dispara sempre, seja
  // qual for a página em que o dia mudou para o utilizador.
  const { currentTask, pendingTasks, isAnswering, hasError, answer, dismiss } =
    useOverdueCheckins(isAuthenticated ? user?.id : null);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <SkipToContentLink />
      <ScrollProgressBar />
      <Navbar />
      {/* id + tabIndex: target for SkipToContentLink and for focus to land
          on after route changes without a visible outline ring stuck on
          it forever (browsers only show :focus-visible on keyboard-driven
          focus, so a click-driven scroll-to-top doesn't get one). */}
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 scroll-mt-16 focus:outline-none"
      >
        <PageTrail />
        {showAcademicSelectors && (
          <div className="print-hide">
            <AcademicSelectors />
          </div>
        )}
        {/* Ao mudar de secao (/tasks -> /schedule) o conteudo entra com um
            fade curto; mudar so de parametro (/tasks/1 -> /tasks/2) nao
            remonta nada. */}
        <div key={pathname.split('/')[1]} className="motion-page">
          {children}
        </div>
      </main>
      <Footer />
      <BackToTopButton />

      {currentTask && (
        <Suspense fallback={null}>
          <OverdueCheckinModal
            key={currentTask.id}
            task={currentTask}
            queueLength={pendingTasks.length}
            isAnswering={isAnswering}
            onAnswer={answer}
            hasError={hasError}
            onDismiss={dismiss}
          />
        </Suspense>
      )}
    </div>
  );
}
