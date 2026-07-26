import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { useAuth } from '../../context/useAuth';
import { useOverdueCheckins } from '../../hooks/useOverdueCheckins';
import OverdueCheckinModal from '../Tasks/OverdueCheckinModal';
import AcademicSelectors from './AcademicSelectors';

// Pages whose content doesn't change with the active program/period, so
// the Program/Period pickers up top would just sit there doing nothing -
// Profile is account-level settings, not scoped to any one program.
const ROUTES_WITHOUT_ACADEMIC_SELECTORS = ['/profile'];

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const showAcademicSelectors =
    isAuthenticated && !ROUTES_WITHOUT_ACADEMIC_SELECTORS.includes(pathname);

  // Fica aqui (em vez de em cada página individual) precisamente porque
  // o PageLayout é o único ponto comum a todas as páginas autenticadas -
  // garante que o check-in de tasks fora de prazo dispara sempre, seja
  // qual for a página em que o dia mudou para o utilizador.
  const { currentTask, pendingTasks, isAnswering, answer } =
    useOverdueCheckins(isAuthenticated);

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <Navbar />
      {/* O container principal que alinha tudo ao centro e dá margens */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1">
        {showAcademicSelectors && (
          <div className="print-hide">
            <AcademicSelectors />
          </div>
        )}
        {children}
      </main>
      <Footer />

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