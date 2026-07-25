import { useState } from 'react';
import type { ProgramAverage } from '../../types/models';
import { CalculatorIcon } from '../UI/Icons';

interface CreditSimulatorProps {
  programAverage: ProgramAverage;
  scale: string;
}

function scaleMax(scale: string): number {
  const parts = scale.split('-').map(Number);
  const max = parts[1];
  return Number.isFinite(max) && max > 0 ? max : 20;
}

// "If I add a course worth X credits with grade Y, what does my cumulative
// average become?" - reuses the same weighted-average math the backend
// uses (see grade-average.util.ts computeCreditWeightedAverage), just run
// client-side against the totalWeight the API now returns alongside the
// average, instead of needing a dedicated simulation endpoint.
export default function CreditSimulator({ programAverage, scale }: CreditSimulatorProps) {
  const max = scaleMax(scale);
  const [credits, setCredits] = useState('6');
  const [grade, setGrade] = useState('');

  if (programAverage.average === null) return null;

  const creditsNum = Number(credits);
  const gradeNum = Number(grade);
  const hasValidInputs = credits !== '' && grade !== '' && creditsNum > 0 && !Number.isNaN(gradeNum);

  const projectedAverage = hasValidInputs
    ? (programAverage.average * programAverage.totalWeight + gradeNum * creditsNum) /
      (programAverage.totalWeight + creditsNum)
    : null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-1 flex items-center gap-1.5">
        <CalculatorIcon className="shrink-0" />
        "What if" GPA simulator
      </p>
      <p className="text-sm text-neutral-400 mb-3">
        Since courses with more credits pull your cumulative average more (a 6-credit course
        counts more than a 3-credit one), this answers "if I take/finish one more course worth N
        credits and get grade G in it, what does my overall average become?" - without waiting
        for the grade to actually be entered.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="number"
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          placeholder="Credits"
          min={1}
          className="w-24 border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-1.5 text-sm placeholder:text-neutral-500"
        />
        <input
          type="number"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder={`Grade (0-${max})`}
          min={0}
          max={max}
          step="0.1"
          className="flex-1 min-w-[120px] border border-neutral-700 bg-neutral-900 text-white rounded-lg px-3 py-1.5 text-sm placeholder:text-neutral-500"
        />
      </div>

      {hasValidInputs && projectedAverage !== null ? (
        <p className="text-sm text-neutral-200">
          Your cumulative average would go from{' '}
          <span className="font-semibold">{programAverage.average.toFixed(2)}</span> to{' '}
          <span className="font-bold text-lg text-violet-400">
            {projectedAverage.toFixed(2)}
          </span>
          .
        </p>
      ) : (
        <p className="text-sm text-neutral-500">Fill in both fields to simulate.</p>
      )}
    </div>
  );
}
