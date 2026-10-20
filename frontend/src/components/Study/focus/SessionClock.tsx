import type { ReactNode } from 'react';
import { useStudyClock } from '../../../context/useStudyClock';
import { formatElapsed } from '../../../lib/formatDuration';

// Os unicos componentes que ouvem o relogio (muda 1x/s). Quem os usa
// (timer global, widget do Focus, modo foco) nao volta a renderizar a cada
// segundo, nem os avisos e formularios a volta.

// Tempo da sessao ativa: o que falta no bloco ou, sem bloco, o decorrido.
export default function SessionClock({ className }: { className?: string }) {
  const { elapsedSeconds, remainingSeconds } = useStudyClock();
  return <span className={className}>{formatElapsed(remainingSeconds ?? elapsedSeconds)}</span>;
}

// Mostra `finished` quando o bloco chegou a zero, senao `running`.
export function BlockFinishedSwitch({ running, finished }: { running: ReactNode; finished: ReactNode }) {
  const { remainingSeconds } = useStudyClock();
  return <>{remainingSeconds === 0 ? finished : running}</>;
}
