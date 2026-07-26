import { useEffect, useState } from 'react';
import { getProgramCredits } from '../../api/academicService';
import type { CreditsSummary } from '../../types/models';
import { useAcademic } from '../../context/useAcademic';
import { GraduationCapIcon } from '../UI/Icons';

// Cumulative across ALL periods of the active program (archived included) -
// same scope as the cumulative average in GpaSummary, since "credits
// accumulated" is a whole-program concept, not something that resets per
// period. See getPassThreshold() in the backend's grade-average.util.ts
// for how "passed" is determined (the scale's midpoint, since there's no
// explicit passing-grade concept stored anywhere yet).
export default function CreditsAccumulatedCard() {
  const { activeProgram } = useAcademic();
  const [summary, setSummary] = useState<CreditsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!activeProgram) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const data = await getProgramCredits(activeProgram.id);
        if (!cancelled) setSummary(data);
      } catch (err) {
        console.error('Failed to load credits summary:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeProgram]);

  if (!activeProgram || isLoading || !summary) return null;

  // No Area with credits set has a graded task yet - showing "0 of 0" would
  // read as a broken feature rather than as "nothing to report yet".
  if (summary.attemptedCredits === 0) return null;

  const passedAreas = summary.areas.filter((a) => a.passed && a.credits !== null);

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-4 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 flex items-center gap-1.5 mb-1">
        <GraduationCapIcon className="shrink-0" />
        ECTS credits accumulated
      </p>
      <p className="text-2xl font-bold text-violet-400">
        {summary.earnedCredits} <span className="text-neutral-500 text-lg">/ {summary.attemptedCredits}</span>
      </p>
      <p className="text-xs text-neutral-500">
        Passing mark: {summary.passThreshold} ({summary.gradeScale})
      </p>

      {passedAreas.length > 0 && (
        <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap gap-x-4 gap-y-1">
          {passedAreas.map((area) => (
            <span key={area.areaId} className="text-sm text-neutral-300">
              {area.areaName} <span className="text-neutral-500">({area.credits} ECTS)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
