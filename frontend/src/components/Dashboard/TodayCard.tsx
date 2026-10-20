import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTodayOverview } from '../../hooks/useTodayOverview';
import { useNow } from '../../hooks/useNow';
import type { AgendaItem } from '../../lib/agenda';
import { AGENDA_TONE_CLASSES, getAgendaTone } from '../../lib/agendaTone';
import { MONTH_CHIP_FALLBACK_KEY } from '../../lib/monthAgenda';
import { currentOrNextAgendaItem, minutesSinceMidnight, nextStudyBlock } from '../../lib/todayOverview';
import { toDateKey } from '../../lib/dateKey';
import { todayUtcAnchored } from '../../lib/weekDates';
import { formatClock, formatDayLabel } from '../../lib/timeFormat';
import { ClockIcon, GraduationCapIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { useI18n } from '../../i18n/useI18n';

const MAX_DUE_SHOWN = 4;

function TodayRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      {children}
    </div>
  );
}

const timeRange = (start: number, end: number) => `${formatClock(start)}-${formatClock(end)}`;

function AgendaSlot({ item }: { item: AgendaItem }) {
  const { t } = useI18n();
  const tone = getAgendaTone(item);
  const classes = AGENDA_TONE_CLASSES[tone];
  const fallbackKey = MONTH_CHIP_FALLBACK_KEY[tone];
  const label =
    item.kind === 'class' ? item.occurrence.subject : (item.occurrence.label ?? (fallbackKey ? t(fallbackKey) : ''));
  const location = item.kind === 'class' ? item.occurrence.location : null;
  return (
    <div className={`rounded-md px-2 py-1 text-xs ${classes.card}`}>
      <p className={`font-medium break-words ${classes.title}`}>{label}</p>
      <p className={classes.meta}>
        {timeRange(item.startMinutes, item.endMinutes)}
        {location ? ` · ${location}` : ''}
      </p>
    </div>
  );
}

// "Hoje" num so cartao: a aula ou turno a decorrer (ou o proximo), o proximo
// bloco de estudo do plano e as tasks que vencem hoje. Atualiza a hora de
// minuto a minuto, so com o separador visivel.
export default function TodayCard() {
  const { t } = useI18n();
  const overview = useTodayOverview();
  const now = useNow();

  if (!overview) return null;

  const todayKey = toDateKey(todayUtcAnchored(now));
  const nowMinutes = minutesSinceMidnight(now);
  const agendaItem = currentOrNextAgendaItem(overview.agenda, nowMinutes);
  const studyBlock = nextStudyBlock(overview.studyBlocks, todayKey, nowMinutes);
  const isHappeningNow = agendaItem !== null && agendaItem.startMinutes <= nowMinutes;
  const { dueToday } = overview;
  const hiddenDue = dueToday.length - MAX_DUE_SHOWN;

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <ClockIcon className="shrink-0" />
        {t('today.title')} · {formatDayLabel(todayKey)}
      </CardHeading>

      <div className="space-y-3">
        <TodayRow label={isHappeningNow ? t('today.now') : t('today.next')}>
          {agendaItem ? (
            <AgendaSlot item={agendaItem} />
          ) : (
            <p className="text-xs text-neutral-500">{t('today.noMoreAgenda')}</p>
          )}
        </TodayRow>

        <TodayRow label={t('today.study')}>
          {studyBlock ? (
            <Link
              to="/focus"
              className="block rounded-md border border-violet-800/50 bg-violet-950/40 px-2 py-1 text-xs text-violet-200 hover:border-violet-600"
            >
              <span className="block font-medium break-words">{studyBlock.taskTitle}</span>
              <span className="block opacity-70">
                {timeRange(studyBlock.startMinutes, studyBlock.endMinutes)}
                {studyBlock.areaName ? ` · ${studyBlock.areaName}` : ''}
              </span>
            </Link>
          ) : (
            <p className="text-xs text-neutral-500">{t('today.noStudy')}</p>
          )}
        </TodayRow>

        <TodayRow label={t('today.due', { count: dueToday.length })}>
          {dueToday.length === 0 && <p className="text-xs text-neutral-500">{t('today.nothingDue')}</p>}
          {dueToday.length > 0 && (
            <ul className="space-y-1">
              {dueToday.slice(0, MAX_DUE_SHOWN).map((task) => (
                <li key={task.id}>
                  <Link
                    to={`/tasks?open=${encodeURIComponent(task.id)}`}
                    className="flex min-w-0 items-center gap-1.5 text-sm text-neutral-200 hover:text-violet-300"
                  >
                    {task.academicTypeIsEvent && (
                      <GraduationCapIcon aria-hidden className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                    )}
                    <span className="truncate">{task.title}</span>
                  </Link>
                </li>
              ))}
              {hiddenDue > 0 && (
                <li className="text-xs text-neutral-500">{t('schedule.month.more', { count: hiddenDue })}</li>
              )}
            </ul>
          )}
        </TodayRow>
      </div>

      <Link
        to="/schedule"
        className="mt-3 inline-block text-xs text-violet-400 underline decoration-dotted hover:text-violet-300"
      >
        {t('today.openSchedule')}
      </Link>
    </DashboardCard>
  );
}
