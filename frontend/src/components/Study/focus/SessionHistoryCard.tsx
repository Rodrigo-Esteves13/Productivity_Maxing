import { useMemo, useState } from 'react';
import { createManualSession, deleteStudySession, updateStudySession } from '../../../api/studySessionsService';
import { useActiveStudySession } from '../../../context/useActiveStudySession';
import { useSessionHistory } from '../../../hooks/useSessionHistory';
import { useIncrementalReveal } from '../../../hooks/useIncrementalReveal';
import { getApiMessage } from '../../../lib/httpError';
import { toLocalParts } from '../../../lib/sessionWindow';
import { formatDayLabel } from '../../../lib/timeFormat';
import { PlusIcon } from '../../UI/Icons';
import EmptyState from '../../UI/EmptyState';
import Select from '../../UI/Select';
import ErrorState from '../../UI/ErrorState';
import LoadingState from '../../UI/LoadingState';
import SessionForm, { type SessionFormValues } from './SessionForm';
import SessionRow from './SessionRow';
import type { StudySession } from '../../../types/models';

// Intervalos que o utilizador pode escolher (o backend limita a 90 dias).
const HISTORY_RANGE_OPTIONS = [7, 14, 30, 90] as const;
const DEFAULT_HISTORY_DAYS = 14;
// Quantos dias aparecem de cada vez; o resto fica atras de "Show more".
const DAYS_PER_PAGE = 5;

function groupByDay(sessions: StudySession[]): [string, StudySession[]][] {
  const groups = new Map<string, StudySession[]>();
  for (const session of sessions) {
    const day = toLocalParts(session.startedAt).date;
    groups.set(day, [...(groups.get(day) ?? []), session]);
  }
  return [...groups.entries()];
}

// Ultimos dias de sessoes, com corrigir, apagar e acrescentar uma que te
// esqueceste de ligar. Dados fiaveis aqui = previsoes melhores.
export default function SessionHistoryCard() {
  const { activeSession } = useActiveStudySession();
  const [historyDays, setHistoryDays] = useState<number>(DEFAULT_HISTORY_DAYS);
  const { sessions, isLoading, error, reload } = useSessionHistory(historyDays, activeSession?.id ?? null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [serverError, setServerError] = useState('');

  const groups = useMemo(() => groupByDay(sessions), [sessions]);
  const { visibleCount, hasMore, canCollapse, showMore, collapse } = useIncrementalReveal(
    groups.length,
    DAYS_PER_PAGE,
    historyDays,
  );
  const visibleGroups = groups.slice(0, visibleCount);

  // Corre uma mutacao, mostra a mensagem do servidor se falhar e recarrega se correr bem.
  const mutate = async (action: () => Promise<unknown>, failure: string): Promise<boolean> => {
    setIsSaving(true);
    setServerError('');
    try {
      await action();
      await reload();
      return true;
    } catch (caught) {
      setServerError(getApiMessage(caught, failure));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreate = async (values: SessionFormValues) => {
    const ok = await mutate(() => createManualSession(values), 'Could not add the session.');
    if (ok) setIsAdding(false);
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Session history</h2>
          <p className="text-xs text-neutral-500">Forgot to start the timer, or stopped too late? Fix it here.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-40">
            <Select
              aria-label="History range"
              value={String(historyDays)}
              onChange={(e) => setHistoryDays(Number(e.target.value))}
            >
              {HISTORY_RANGE_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  Last {days} days
                </option>
              ))}
            </Select>
          </div>
          {!isAdding && (
            <button
              type="button"
              onClick={() => {
                setServerError('');
                setIsAdding(true);
              }}
              className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300"
            >
              <PlusIcon />
              Add session
            </button>
          )}
        </div>
      </div>

      {isAdding && (
        <div className="mb-4">
          <SessionForm isSaving={isSaving} serverError={serverError} onSubmit={handleCreate} onCancel={() => setIsAdding(false)} />
        </div>
      )}

      {isLoading && <LoadingState message="Loading sessions..." />}
      {!isLoading && error && <ErrorState message="Could not load your sessions." />}
      {!isLoading && !error && groups.length === 0 && <EmptyState message={`No sessions in the last ${historyDays} days.`} />}

      <div className="space-y-4">
        {visibleGroups.map(([day, daySessions]) => (
          <section key={day}>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-500">{formatDayLabel(day)}</h3>
            <ul className="space-y-1.5">
              {daySessions.map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isSaving={isSaving}
                  serverError={serverError}
                  onEdit={(id, values) => mutate(() => updateStudySession(id, values), 'Could not save the changes.')}
                  onDelete={(id) => mutate(() => deleteStudySession(id), 'Could not delete the session.')}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      {(hasMore || canCollapse) && (
        <div className="mt-4 flex items-center justify-center gap-4 text-sm">
          {hasMore && (
            <button type="button" onClick={showMore} className="text-violet-400 hover:text-violet-300">
              Show more days ({groups.length - visibleCount} left)
            </button>
          )}
          {canCollapse && (
            <button type="button" onClick={collapse} className="text-neutral-400 hover:text-neutral-200">
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
