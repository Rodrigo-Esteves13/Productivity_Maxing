import type { ReactNode } from 'react';
import { Navbar } from '../Navbar';
import { Footer } from '../Footer';
import { useAuth } from '../../context/useAuth';
import { useOverdueCheckins } from '../../hooks/useOverdueCheckins';
import OverdueCheckinModal from '../Tasks/OverdueCheckinModal';

interface PageLayoutProps {
  children: ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  const { isAuthenticated } = useAuth();

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