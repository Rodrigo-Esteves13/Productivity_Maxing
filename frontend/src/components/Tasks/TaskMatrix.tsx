import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { groupByQuadrant, QUADRANTS, type Quadrant } from '../../lib/eisenhower';
import { formatTaskDue } from '../../lib/taskReadiness';
import { useI18n } from '../../i18n/useI18n';

interface TaskMatrixProps {
  // Ja filtradas e ordenadas pela pagina (arquivadas, ordem escolhida).
  tasks: Task[];
  onSelect: (task: Task) => void;
}

// Cor da borda de cada quadrante (sem verde).
const QUADRANT_BORDER: Record<Quadrant, string> = {
  doFirst: 'border-red-700/60',
  schedule: 'border-violet-700/60',
  quick: 'border-amber-700/60',
  later: 'border-neutral-800',
};

// Matriz de Eisenhower: urgente x importante, 2 por linha a partir de sm.
export default function TaskMatrix({ tasks, onSelect }: TaskMatrixProps) {
  const { t, lang } = useI18n();
  const groups = useMemo(() => groupByQuadrant(tasks), [tasks]);

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QUADRANTS.map((quadrant) => (
          <section key={quadrant} className={`rounded-lg border bg-neutral-900/50 p-3 ${QUADRANT_BORDER[quadrant]}`}>
            <h3 className="text-sm font-semibold text-white">
              {t(`eisenhower.${quadrant}`)} <span className="font-normal text-neutral-500">({groups[quadrant].length})</span>
            </h3>
            <p className="mb-2 text-xs text-neutral-500">{t(`eisenhower.${quadrant}Help`)}</p>
            <ul className="space-y-1">
              {groups[quadrant].map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(task)}
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1 text-left text-sm text-neutral-200 hover:bg-neutral-800"
                  >
                    <span className="min-w-0 truncate">{task.title}</span>
                    <span className="shrink-0 text-xs tabular-nums text-neutral-500">{formatTaskDue(task, lang)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-2 text-xs text-neutral-500">{t('eisenhower.hint')}</p>
    </div>
  );
}
