import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { useAuth } from '../../context/useAuth';
import { useOverdueCheckins } from '../../hooks/useOverdueCheckins';
import OverdueCheckinModal from '../Tasks/OverdueCheckinModal';
import AcademicSelectors from './AcademicSelectors';
import SkipToContentLink from '../UI/SkipToContentLink';
import ScrollProgressBar from '../UI/ScrollProgressBar';
import BackToTopButton from '../UI/BackToTopButton';

// Only Dashboard and Tasks actually change with the active program/period
// - everywhere else (Focus, Profile, Developer, Agent, Areas, admin
// pages, ...) the Program/Period pickers up top would just sit there
// doing nothing, or worse, look like they filter content that isn't
// actually scoped by them.
const ROUTES_WITH_ACADEMIC_SELECTORS = ['/dashboard', '/tasks'];

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const showAcademicSelectors =
    isAuthenticated && ROUTES_WITH_ACADEMIC_SELECTORS.includes(pathname);

  // Fica aqui (em vez de em cada página individual) precisamente porque
  // o PageLayout é o único ponto comum a todas as páginas autenticadas -
  // garante que o check-in de tasks fora de prazo dispara sempre, seja
  // qual for a página em que o dia mudou para o utilizador.
  const { currentTask, pendingTasks, isAnswering, answer } =
    useOverdueCheckins(isAuthenticated);

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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 focus:outline-none"
      >
        {showAcademicSelectors && (
          <div className="print-hide">
            <AcademicSelectors />
          </div>
        )}
        {children}
      </main>
      <Footer />
      <BackToTopButton />

      {currentTask && (
        <OverdueCheckinModal
          task={currentTask}
          queueLength={pendingTasks.length}
          isAnswering={isAnswering}
          onAnswer={answer}
        />
      )}
    </div>
  );
}
