import { useState } from 'react';
import { formatDuration } from '../../../lib/timeFormat';

const STEP_MINUTES = 30;
const MIN_MINUTES = 30;
const MAX_MINUTES = 720;

interface DailyLimitControlProps {
  value: number;
  onCommit: (minutes: number) => void;
}

// Salvaguarda de 30 em 30 minutos. Só grava quando o utilizador larga o
// controlo, para não disparar um pedido (e um recálculo do plano) a
// cada passo do slider.
export default function DailyLimitControl({ value, onCommit }: DailyLimitControlProps) {
  const [draft, setDraft] = useState(value);

  return (
    <div className="mb-4">
      <label
        htmlFor="daily-study-limit"
        className="flex items-center justify-between text-xs text-neutral-400 mb-1"
      >
        <span>Daily study limit</span>
        <span className="text-neutral-200 font-medium">{formatDuration(draft)}</span>
      </label>
      <input
        id="daily-study-limit"
        type="range"
        min={MIN_MINUTES}
        max={MAX_MINUTES}
        step={STEP_MINUTES}
        value={draft}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => draft !== value && onCommit(draft)}
        onKeyUp={() => draft !== value && onCommit(draft)}
        className="w-full accent-violet-500"
      />
    </div>
  );
}
