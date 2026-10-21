import { useState } from 'react';
import type { StudyPlanDay, StudyPlanSuggestion } from '../../../types/models';
import { formatClock, formatDayLabel, formatDuration } from '../../../lib/timeFormat';
import StudyBlockTitle from '../StudyBlockTitle';
import TabBar, { type TabBarItem } from '../../UI/TabBar';
import { useI18n } from '../../../i18n/useI18n';

interface PlanDayListProps {
  suggestions: StudyPlanSuggestion[];
  days: StudyPlanDay[];
  dailyLimitMinutes: number;
}

function groupByDay(suggestions: StudyPlanSuggestion[]): Map<string, StudyPlanSuggestion[]> {
  const byDay = new Map<string, StudyPlanSuggestion[]>();
  for (const s of suggestions) {
    const list = byDay.get(s.date) ?? [];
    list.push(s);
    byDay.set(s.date, list);
  }
  return byDay;
}

// Um dia de cada vez, escolhido nos separadores: com os 7 dias todos
// abertos a coluna do plano nunca mais acabava.
export default function PlanDayList({ suggestions, days, dailyLimitMinutes }: PlanDayListProps) {
  const { t } = useI18n();
  const byDay = groupByDay(suggestions);
  const visibleDays = days.filter((d) => byDay.has(d.date));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Sem escolha (ou o dia escolhido saiu do plano ao recalcular): o primeiro.
  const day = visibleDays.find((d) => d.date === selectedDate) ?? visibleDays[0];
  if (!day) return null;

  const tabs: TabBarItem<string>[] = visibleDays.map((d) => ({
    value: d.date,
    label: formatDayLabel(d.date),
    count: byDay.get(d.date)?.length,
  }));
  const loadPct = Math.min(100, Math.round((day.studyMinutes / dailyLimitMinutes) * 100));

  return (
    <section aria-labelledby="plan-days-heading">
      <h3
        id="plan-days-heading"
        className="text-xs uppercase tracking-wide text-neutral-500 mb-2"
      >
        {t('ui.dayByDay')}
      </h3>
      <TabBar items={tabs} value={day.date} onChange={setSelectedDate} label={t('ui.dayByDay')} className="mb-3" />
      <div role="tabpanel" aria-label={formatDayLabel(day.date)}>
        {/* A data ja esta no separador ativo: aqui so os totais do dia. */}
        <div className="mb-1.5">
          <p className="text-xs text-neutral-500">
            {t('ui.planStudyDuration', { duration: formatDuration(day.studyMinutes) })}
            {day.classMinutes > 0 && ` · ${t('ui.planClassDuration', { duration: formatDuration(day.classMinutes) })}`}
            {day.workMinutes > 0 && ` · ${t('ui.planWorkDuration', { duration: formatDuration(day.workMinutes) })}`}
          </p>
        </div>
        <div
          className="h-1 rounded-full bg-neutral-800 overflow-hidden mb-2"
          aria-hidden="true"
        >
          <div
            className={`h-full ${day.overtimeMinutes > 0 ? 'bg-amber-500' : 'bg-violet-500'}`}
            style={{ width: `${loadPct}%` }}
          />
        </div>
        <ul className="space-y-1.5">
          {(byDay.get(day.date) ?? []).map((s) => (
            <li
              key={`${s.taskId}-${s.startMinutes}`}
              className={`flex items-center justify-between text-sm rounded-lg px-3 py-2 ${
                s.isOvertime
                  ? 'bg-amber-950/20 border border-amber-900/40'
                  : 'bg-neutral-800/60'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2 text-neutral-200">
                <StudyBlockTitle block={s} />
                {s.kind === 'review' && <span className="shrink-0 text-[11px] text-violet-300">{t('ui.reviewLower')}</span>}
              </span>
              <span className="text-neutral-500 shrink-0 ml-3">
                {s.isOvertime && <span className="text-amber-400 mr-2">{t('ui.overtime')}</span>}
                {formatClock(s.startMinutes)}-{formatClock(s.endMinutes)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
