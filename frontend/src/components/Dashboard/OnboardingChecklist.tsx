import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { CheckIcon, XIcon } from '../UI/Icons';
import { getSchedule } from '../../api/scheduleService';
import { getSessionHistory } from '../../api/studySessionsService';
import { useCalendarStatus } from '../../hooks/useCalendarStatus';

const DISMISSED_KEY = 'pmaxing:onboarding-dismissed';
const MS_PER_DAY = 86_400_000;

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dateKey(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * MS_PER_DAY).toISOString().slice(0, 10);
}

interface OnboardingChecklistProps {
  // Total de tasks do utilizador (sem filtros) ja carregadas pelo Dashboard.
  taskCount: number;
}

interface Step {
  id: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
}

// Primeiros passos, deduzidos dos dados que ja existem (sem schema novo).
// Desaparece sozinho quando tudo esta feito, ou ao ser dispensado.
export default function OnboardingChecklist({ taskCount }: OnboardingChecklistProps) {
  const [dismissed, setDismissed] = useState(readDismissed);
  const calendarConnected = useCalendarStatus();
  // null = ainda a carregar (nao mostra nada para nao piscar passos "por fazer").
  const [hasSchedule, setHasSchedule] = useState<boolean | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (dismissed) return;
    const controller = new AbortController();
    getSchedule(dateKey(-60), dateKey(180), controller.signal)
      .then((rows) => setHasSchedule(rows.length > 0))
      .catch(() => setHasSchedule(null));
    getSessionHistory(90, controller.signal)
      .then((rows) => setHasSession(rows.length > 0))
      .catch(() => setHasSession(null));
    return () => controller.abort();
  }, [dismissed]);

  if (dismissed || hasSchedule === null || hasSession === null || calendarConnected === null) {
    return null;
  }

  const steps: Step[] = [
    {
      id: 'task',
      label: 'Add your first task',
      hint: 'Deadlines, exams and assignments live here.',
      to: '/tasks',
      done: taskCount > 0,
    },
    {
      id: 'schedule',
      label: 'Import your timetable',
      hint: 'Upload the .ics from the student portal.',
      to: '/schedule',
      done: hasSchedule,
    },
    {
      id: 'calendar',
      label: 'See it in your calendar',
      hint: 'Connect Google Calendar, or subscribe with the .ics feed on the Schedule page.',
      to: '/schedule',
      done: calendarConnected,
    },
    {
      id: 'focus',
      label: 'Run a focus session',
      hint: 'Track study time to get better estimates.',
      to: '/focus',
      done: hasSession,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // sem storage: dispensa so nesta sessao
    }
    setDismissed(true);
  };

  return (
    <DashboardCard className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <CardHeading className="mb-3">
          Getting started ({doneCount}/{steps.length})
        </CardHeading>
        <button
          type="button"
          onClick={dismiss}
          className="text-neutral-500 hover:text-neutral-200"
          aria-label="Dismiss getting started checklist"
          title="Dismiss"
        >
          <XIcon width={14} height={14} />
        </button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
                step.done
                  ? 'border-neutral-800 bg-neutral-900/30 text-neutral-500'
                  : 'border-neutral-800 hover:border-violet-700 text-neutral-200'
              }`}
            >
              <span
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                  step.done ? 'border-violet-500 bg-violet-500 text-white' : 'border-neutral-600'
                }`}
              >
                {step.done && <CheckIcon width={10} height={10} />}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${step.done ? 'line-through' : ''}`}>
                  {step.label}
                </span>
                {!step.done && <span className="block text-xs text-neutral-500">{step.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
