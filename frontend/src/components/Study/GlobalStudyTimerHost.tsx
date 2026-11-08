import { Suspense } from 'react';
import { useAuth } from '../../context/useAuth';
import { useActiveStudySession } from '../../context/useActiveStudySession';
import { useAmbientSound } from '../../context/useAmbientSound';
import { lazyWithPreload } from '../../lib/lazyWithPreload';
import AmbientMiniControl from './focus/AmbientMiniControl';

const GlobalStudyTimer = lazyWithPreload(() => import('./GlobalStudyTimer'));

// O timer global e os avisos (inatividade, fim de bloco, pausa, foco por
// classificar) so existem com uma sessao, uma pausa ou uma sessao acabada
// de parar. Sem nada disso, o JS deles nem e descarregado.
export default function GlobalStudyTimerHost() {
  const { isAuthenticated } = useAuth();
  const { activeSession, restBreak, justStopped } = useActiveStudySession();
  const { isPlaying } = useAmbientSound();
  if (!isAuthenticated) return null;
  const showTimer = Boolean(activeSession || restBreak || justStopped);
  if (!showTimer && !isPlaying) return null;
  return (
    <>
      {showTimer && (
        <Suspense fallback={null}>
          <GlobalStudyTimer />
        </Suspense>
      )}
      {/* Sem sessao ativa o pill do timer nao existe: o som de fundo que
          continua a tocar ganha o seu proprio pill, para se poder parar. */}
      {!activeSession && isPlaying && (
        <div className="print-hide fixed bottom-6 left-6 z-40 flex items-center rounded-full border border-violet-500/60 bg-neutral-900/95 p-2 shadow-lg">
          <AmbientMiniControl />
        </div>
      )}
    </>
  );
}
