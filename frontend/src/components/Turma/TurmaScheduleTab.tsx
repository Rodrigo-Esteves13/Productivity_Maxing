import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '../UI/Card';
import ToggleRow from '../UI/ToggleRow';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import { copyTurmaSubject, getTurmaSchedule, setTurmaScheduleSharing } from '../../api/turmasService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { formatClock } from '../../lib/timeFormat';

interface TurmaScheduleTabProps {
  turmaId: string;
}

// Horario da turma: junta as aulas das proximas 2 semanas de quem escolheu
// partilhar (desligado por defeito, nem todos tem as mesmas cadeiras).
// Quem ainda nao importou o .ics copia daqui as cadeiras que tem.
export default function TurmaScheduleTab({ turmaId }: TurmaScheduleTabProps) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const fetcher = useCallback(() => getTurmaSchedule(turmaId), [turmaId]);
  const { data, isLoading, error, reload } = useLoadOnce(fetcher);
  const [busy, setBusy] = useState<string | null>(null);

  const toggleSharing = async (share: boolean) => {
    setBusy('sharing');
    try {
      await setTurmaScheduleSharing(turmaId, share);
      reload();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const copySubject = async (subject: string) => {
    setBusy(subject);
    try {
      const { copied } = await copyTurmaSubject(turmaId, subject);
      notify(t('turma.schedule.copied', { count: copied, subject }), 'success');
      reload();
    } catch {
      notify(t('turma.actionError'), 'error');
    } finally {
      setBusy(null);
    }
  };

  if (isLoading) return <LinesSkeleton lines={4} />;
  if (error || !data) return <ErrorState message={t('turma.schedule.loadError')} />;

  // Agrupado por dia, como a vista semanal do Schedule.
  const days = [...new Set(data.classes.map((c) => c.date))];

  return (
    <div className="space-y-4">
      <Card>
        <ToggleRow
          label={t('turma.schedule.shareLabel')}
          description={t('turma.schedule.shareHelp')}
          checked={data.sharing}
          disabled={busy === 'sharing'}
          onChange={(value) => void toggleSharing(value)}
          variant="inline"
        />
        <p className="mt-2 text-xs text-neutral-500">
          {t('turma.schedule.sharers', { count: data.sharers })}{' '}
          <Link to="/schedule" className="text-violet-400 hover:text-violet-300">
            {t('turma.schedule.openMine')}
          </Link>
        </p>
      </Card>

      {data.classes.length === 0 ? (
        <EmptyState message={data.sharers === 0 ? t('turma.schedule.nobody') : t('turma.schedule.empty')} />
      ) : (
        days.map((day) => (
          <section key={day}>
            <h3 className="mb-2 text-sm font-semibold capitalize text-neutral-300">
              {new Date(`${day}T00:00:00Z`).toLocaleDateString(lang, {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
                timeZone: 'UTC',
              })}
            </h3>
            <ul className="space-y-2">
              {data.classes
                .filter((c) => c.date === day)
                .map((c) => (
                  <li
                    key={`${c.subject}-${c.startMinutes}`}
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 border border-neutral-800 px-3 py-2"
                  >
                    <span className="w-24 shrink-0 tabular-nums text-sm text-neutral-400">
                      {formatClock(c.startMinutes)}-{formatClock(c.endMinutes)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-neutral-100">{c.subject}</p>
                      <p className="text-xs text-neutral-500">
                        {[c.location, t('turma.schedule.sharedBy', { count: c.sharedBy })].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {c.inMine ? (
                      <span className="text-xs text-cyan-400">{t('turma.schedule.inMine')}</span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void copySubject(c.subject)}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300 disabled:opacity-50"
                      >
                        {busy === c.subject ? t('common.saving') : t('turma.schedule.copy')}
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
