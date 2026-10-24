import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from '../UI/Icons';
import { prefersReducedMotion, TASK_COMPLETED_EVENT } from '../../lib/completionFeedback';

// Tempo da animacao (igual ao do keyframe completion-pop em index.css).
const BURST_MS = 900;

// Pequena animacao de "feito" ao concluir tasks. Montado uma vez no App;
// decorativo (aria-hidden): o toast com Undo ja anuncia a conclusao. Com
// menos movimento (sistema ou Profile) nao aparece.
export default function CompletionBurst() {
  const [burstKey, setBurstKey] = useState(0);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onCompleted = () => {
      if (prefersReducedMotion()) return;
      setBurstKey((k) => k + 1);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setBurstKey(0), BURST_MS);
    };
    window.addEventListener(TASK_COMPLETED_EVENT, onCompleted);
    return () => {
      window.removeEventListener(TASK_COMPLETED_EVENT, onCompleted);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (burstKey === 0) return null;

  return (
    <div aria-hidden="true" className="print-hide pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center">
      <span
        key={burstKey}
        className="completion-pop flex h-14 w-14 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg ring-4 ring-violet-400/40"
      >
        <CheckIcon width={28} height={28} />
      </span>
    </div>
  );
}
