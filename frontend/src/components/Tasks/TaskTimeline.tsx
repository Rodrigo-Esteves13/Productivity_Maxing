import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { buildTimeline } from '../../lib/taskTimeline';
import { useI18n } from '../../i18n/useI18n';

interface TaskTimelineProps {
  // Ja filtradas e ordenadas pela pagina (arquivadas, ordem escolhida).
  tasks: Task[];
  onSelect: (task: Task) => void;
}

const LABEL_COLUMN = 'w-40 sm:w-56 shrink-0';

// Gantt simples: cada task aberta e uma barra do dia em que abre (ou hoje)
// ate ao prazo, nas proximas 8 semanas. O titulo fica numa coluna fixa e a
// area das barras faz scroll horizontal dentro do cartao (a pagina nunca).
export default function TaskTimeline({ tasks, onSelect }: TaskTimelineProps) {
  const { t, lang } = useI18n();
  const model = useMemo(() => buildTimeline(tasks), [tasks]);
  const dayFormat = useMemo(() => new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }), [lang]);

  if (model.rows.length === 0) {
    return <p className="text-sm text-neutral-400">{t('timeline.empty')}</p>;
  }

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg overflow-x-auto">
      <div className="min-w-[640px] p-3">
        <div className="flex">
          <div className={LABEL_COLUMN} />
          <div className="relative h-6 flex-1" aria-hidden="true">
            {model.weekStarts.map((week) => (
              <span
                key={week.leftPct}
                className="absolute text-[11px] text-neutral-500 tabular-nums"
                style={{ left: `${week.leftPct}%` }}
              >
                {dayFormat.format(week.label)}
              </span>
            ))}
          </div>
        </div>
        <ul>
          {model.rows.map((row) => (
            <li key={row.task.id} className="flex items-center border-t border-neutral-800/70">
              <button
                type="button"
                onClick={() => onSelect(row.task)}
                className={`${LABEL_COLUMN} truncate py-2 pr-3 text-left text-sm text-neutral-200 hover:text-white`}
                title={row.task.title}
              >
                {row.task.title}
              </button>
              <div className="relative h-6 flex-1">
                {model.weekStarts.map((week) => (
                  <span
                    key={week.leftPct}
                    className="absolute top-0 h-full border-l border-neutral-800/70"
                    style={{ left: `${week.leftPct}%` }}
                    aria-hidden="true"
                  />
                ))}
                <button
                  type="button"
                  onClick={() => onSelect(row.task)}
                  aria-label={row.task.title}
                  className={`absolute top-1 h-4 rounded ${
                    row.overdue ? 'bg-red-500/80' : 'bg-violet-500/80'
                  } ${row.clippedEnd ? 'rounded-r-none' : ''} hover:brightness-125`}
                  style={{ left: `${row.leftPct}%`, width: `${row.widthPct}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-neutral-500">{t('timeline.hint')}</p>
      </div>
    </div>
  );
}
