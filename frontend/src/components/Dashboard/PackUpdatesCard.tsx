import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { PackSharedFields } from '../../api/taskPackService';
import { usePackUpdates } from '../../hooks/usePackUpdates';
import { useI18n } from '../../i18n/useI18n';
import { RefreshIcon } from '../UI/Icons';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import Button from '../UI/Button';
import Skeleton from '../UI/Skeleton';

const MAX_SHOWN = 3;

// Rotulo (chave i18n) de cada campo que o dono pode ter mudado.
const FIELD_LABEL: Record<keyof PackSharedFields, string> = {
  title: 'ui.title',
  date: 'ui.date',
  weightPercentage: 'packs.updates.field.weight',
  effort: 'readiness.effort',
  dateCertainty: 'readiness.dateCertainty',
  availableFrom: 'readiness.availableFrom',
  isBlocked: 'readiness.blocked',
  submissionDate: 'twoPhase.handInDate',
};

// Atualizacoes de pacotes importados por aprovar. Reutiliza usePackUpdates
// (o mesmo pedido do aviso em Tasks e de /task-packs). Sem pedidos, ou se o
// pedido falha, o cartao nao aparece: so mostra um esqueleto a carregar.
export default function PackUpdatesCard() {
  const { t } = useI18n();
  const { updates, isLoading, hasError, busyId, accept, reject } = usePackUpdates();
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (isLoading) {
    return (
      <DashboardCard>
        <Skeleton className="mb-3 h-4 w-1/2" />
        <Skeleton className="mb-2 h-4 w-3/4" />
        <Skeleton className="h-8 w-full" />
      </DashboardCard>
    );
  }
  if (hasError || updates.length === 0) return null;

  const run = async (id: string, action: (id: string) => Promise<string | null>) => {
    const message = await action(id);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  };

  const shown = updates.slice(0, MAX_SHOWN);

  return (
    <DashboardCard>
      <CardHeading className="mb-3">
        <RefreshIcon className="shrink-0" />
        {t('packUpdatesWidget.title', { count: updates.length })}
      </CardHeading>

      <ul className="space-y-3">
        {shown.map((update) => {
          const fields = (Object.keys(update.changes) as (keyof PackSharedFields)[])
            .filter((key) => key in FIELD_LABEL)
            .map((key) => t(FIELD_LABEL[key]))
            .join(', ');
          const isBusy = busyId === update.id;
          return (
            <li key={update.id} className="text-sm">
              <p className="truncate font-medium text-neutral-200">{update.taskTitle}</p>
              <p className="text-xs text-neutral-500">
                {t('packs.updates.from', { pack: update.packName, name: update.ownerName })}
              </p>
              {fields && (
                <p className="text-xs text-neutral-400">{t('packUpdatesWidget.changed', { fields })}</p>
              )}
              {errors[update.id] && (
                <p role="alert" className="mt-1 text-xs text-red-300">{errors[update.id]}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" disabled={isBusy} onClick={() => void run(update.id, accept)}>
                  {t('packs.updates.accept')}
                </Button>
                <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => void run(update.id, reject)}>
                  {t('packUpdatesWidget.decline')}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <Link
        to="/task-packs#updates"
        className="mt-3 block text-xs text-violet-400 underline decoration-dotted hover:text-violet-300"
      >
        {updates.length > shown.length
          ? t('packUpdatesWidget.viewAllMore', { count: updates.length })
          : t('packUpdatesWidget.viewAll')}
      </Link>
    </DashboardCard>
  );
}
