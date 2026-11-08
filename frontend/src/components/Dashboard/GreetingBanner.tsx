import { useMemo } from 'react';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { useGreetingPrefs } from '../../hooks/useGreetingPrefs';
import { computeProgressSignals, dayPeriodForHour, pickMotivation } from '../../lib/greeting';
import { todayKey } from '../../lib/dateKey';
import { getDateStatus } from '../../utils/taskDateStatus';
import type { Task } from '../../types/models';

interface GreetingBannerProps {
  tasks: Task[];
}

// "Good morning, <name>" (ou o texto da pessoa) + uma frase do dia escolhida
// pelo progresso real das tasks que o Dashboard ja carregou. Sem pedidos novos.
export default function GreetingBanner({ tasks }: GreetingBannerProps) {
  const { t } = useI18n();
  const { user } = useAuth();
  const { customGreeting, showMotivation } = useGreetingPrefs(user?.id);

  const now = useMemo(() => new Date(), []);
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? '';
  const period = dayPeriodForHour(now.getHours());

  const motivation = useMemo(() => {
    const overdueCount = tasks.filter((task) => getDateStatus(task, now) === 'overdue').length;
    return pickMotivation(computeProgressSignals(tasks, now, overdueCount), todayKey(now));
  }, [tasks, now]);

  const custom = customGreeting.trim();
  const hello = custom
    ? custom
    : firstName
      ? t(`greeting.hello.${period}`, { name: firstName })
      : t(`greeting.helloAnon.${period}`);

  return (
    <section aria-label={t('greeting.sectionLabel')} className="mb-4">
      <p className="text-xl font-semibold text-white">{hello}</p>
      {showMotivation && <p className="mt-1 text-sm text-neutral-400">{t(motivation.key, motivation.params)}</p>}
    </section>
  );
}
