import { Suspense } from 'react';
import { useAuth } from '../../context/useAuth';
import { useActiveStudySession } from '../../context/useActiveStudySession';
import { lazyWithPreload } from '../../lib/lazyWithPreload';

const GlobalStudyTimer = lazyWithPreload(() => import('./GlobalStudyTimer'));

// O timer global e os avisos (inatividade, fim de bloco, pausa, foco por
// classificar) so existem com uma sessao, uma pausa ou uma sessao acabada
// de parar. Sem nada disso, o JS deles nem e descarregado.
export default function GlobalStudyTimerHost() {
  const { isAuthenticated } = useAuth();
  const { activeSession, restBreak, justStopped } = useActiveStudySession();
  if (!isAuthenticated || !(activeSession || restBreak || justStopped)) return null;
  return (
    <Suspense fallback={null}>
      <GlobalStudyTimer />
    </Suspense>
  );
}
