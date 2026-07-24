import { useEffect, useState } from 'react';
import { getProgramAverage } from '../../api/academicService';
import { useAcademic } from '../../context/useAcademic';
import type { ProgramAverage } from '../../types/models';

// Only makes sense with more than one program (e.g. "High School" +
// "Bachelor's") - each program keeps its own grade scale, this never
// merges them into a single number, just lays the cards side by side.
export default function ProgramsOverviewCard() {
  const { programs, activeProgram, switchProgram } = useAcademic();
  const [averages, setAverages] = useState<Record<string, ProgramAverage>>({});
  const [isLoading, setIsLoading] = useState(true);

  const visiblePrograms = programs.filter((p) => p.isActive || p.id === activeProgram?.id);

  useEffect(() => {
    if (visiblePrograms.length < 2) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const entries = await Promise.all(
          visiblePrograms.map(async (p) => [p.id, await getProgramAverage(p.id)] as const),
        );
        if (!cancelled) setAverages(Object.fromEntries(entries));
      } catch (err) {
        console.error('Failed to load programs overview:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.map((p) => p.id).join(',')]);

  if (visiblePrograms.length < 2 || isLoading) return null;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 mb-6 shadow-xl">
      <p className="text-xs uppercase tracking-wide text-neutral-500 mb-3">All your programs</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {visiblePrograms.map((program) => {
          const avg = averages[program.id];
          const isActive = program.id === activeProgram?.id;
          return (
            <button
              key={program.id}
              type="button"
              onClick={() => switchProgram(program.id)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                isActive
                  ? 'border-violet-600 bg-violet-950/30'
                  : 'border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <p className="text-sm text-neutral-200 truncate">{program.name}</p>
              <p className="text-xl font-bold text-white">
                {avg?.average !== null && avg?.average !== undefined
                  ? avg.average.toFixed(2)
                  : '—'}
                <span className="text-xs text-neutral-500 font-normal">
                  {' '}
                  / {program.gradeScale.split('-')[1] ?? program.gradeScale}
                </span>
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
