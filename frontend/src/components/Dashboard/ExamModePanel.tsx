import type { Area, Task } from '../../types/models';
import { upcomingExams } from '../../lib/examMode';
import { toDateKey } from '../../lib/dateKey';
import { todayUtcAnchored } from '../../lib/weekDates';
import { formatDayLabel } from '../../lib/timeFormat';
import { getRemainingTimeLabel } from '../../utils/taskDateStatus';
import { useAreaLookup } from '../../hooks/useAreaLookup';
import { GraduationCapIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface ExamModePanelProps {
  tasks: Task[];
  areas: Area[];
  onTurnOff: () => void;
}

const MAX_SHOWN = 4;

// Topo do Dashboard em modo exame: contagem decrescente para os proximos
// testes e exames (o primeiro em destaque) e o botao para sair do modo.
export default function ExamModePanel({ tasks, areas, onTurnOff }: ExamModePanelProps) {
  const { t } = useI18n();
  const areaById = useAreaLookup(areas);
  const exams = upcomingExams(tasks, toDateKey(todayUtcAnchored())).slice(0, MAX_SHOWN);

  return (
    <section className="mb-6 rounded-xl border border-violet-800/60 bg-violet-950/30 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <GraduationCapIcon className="shrink-0 text-violet-300" />
            {t('examMode.title')}
          </h2>
          <p className="mt-1 text-sm text-neutral-400">{t('examMode.help')}</p>
        </div>
        <button
          type="button"
          onClick={onTurnOff}
          className="shrink-0 rounded-lg px-2 py-1 text-sm text-violet-300 hover:bg-neutral-800 hover:text-violet-200"
        >
          {t('examMode.turnOff')}
        </button>
      </div>

      {exams.length === 0 && <p className="mt-3 text-sm text-neutral-500">{t('examMode.none')}</p>}
      {exams.length > 0 && (
        <ol className="mt-4 grid gap-2 sm:grid-cols-2">
          {exams.map((task, index) => {
            const area = areaById.get(task.areaId);
            const isNext = index === 0;
            return (
              <li
                key={task.id}
                className={`min-w-0 rounded-lg border p-3 ${
                  isNext ? 'border-violet-600 bg-violet-900/30' : 'border-neutral-800 bg-neutral-900/50'
                }`}
              >
                <p className={`font-semibold text-violet-300 ${isNext ? 'text-2xl' : 'text-sm'}`}>
                  {getRemainingTimeLabel(task)}
                </p>
                <p className="mt-0.5 text-sm text-neutral-200 break-words">{task.title}</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {formatDayLabel(task.date.slice(0, 10))}
                  {area && ` · ${area.name}`}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
