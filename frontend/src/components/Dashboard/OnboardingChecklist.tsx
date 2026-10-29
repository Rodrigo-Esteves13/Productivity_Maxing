import { MS_PER_DAY } from '../../lib/timeConstants';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import { CheckIcon, XIcon } from '../UI/Icons';
import { getSchedule } from '../../api/scheduleService';
import { getSessionHistory } from '../../api/studySessionsService';
import { useCalendarStatus } from '../../hooks/useCalendarStatus';
import { todayKey } from '../../lib/dateKey';
import { useI18n } from '../../i18n/useI18n';

const DISMISSED_KEY = 'pmaxing:onboarding-dismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

function dateKey(offsetDays: number): string {
  // Dia local (regra 1 em lib/dateKey.ts), nao o dia UTC.
  return todayKey(new Date(Date.now() + offsetDays * MS_PER_DAY));
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
  const { t } = useI18n();
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
      label: t('onboarding.task'),
      hint: t('onboarding.taskHint'),
      to: '/tasks',
      done: taskCount > 0,
    },
    {
      id: 'schedule',
      label: t('onboarding.schedule'),
      hint: t('onboarding.scheduleHint'),
      to: '/schedule',
      done: hasSchedule,
    },
    {
      id: 'calendar',
      label: t('onboarding.calendar'),
      hint: t('onboarding.calendarHint'),
      to: '/schedule',
      done: calendarConnected,
    },
    {
      id: 'focus',
      label: t('onboarding.focus'),
      hint: t('onboarding.focusHint'),
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
          {t('onboarding.title', { done: doneCount, total: steps.length })}
        </CardHeading>
        <button
          type="button"
          onClick={dismiss}
          className="text-neutral-500 hover:text-neutral-200"
          aria-label={t('onboarding.dismiss')}
          title={t('onboarding.dismiss')}
        >
          <XIcon width={14} height={14} />
        </button>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
