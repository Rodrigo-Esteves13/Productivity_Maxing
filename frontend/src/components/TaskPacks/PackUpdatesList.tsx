import { memo, useState } from 'react';
import type { PackSharedFields, PackUpdate } from '../../api/taskPackService';
import Button from '../UI/Button';
import FeedbackBanner from '../UI/FeedbackBanner';
import { useI18n } from '../../i18n/useI18n';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { formatTaskDate } from '../../lib/timeFormat';

interface Props {
  updates: PackUpdate[];
  busyId: string | null;
  onAccept: (id: string) => Promise<string | null>;
  onReject: (id: string) => Promise<string | null>;
}

type FieldKey = keyof PackSharedFields;

// Rotulo de cada campo (chave i18n) e como mostrar o valor. Mapa em vez de
// um switch por campo.
const FIELD_LABEL: Record<FieldKey, string> = {
  title: 'ui.title',
  date: 'ui.date',
  weightPercentage: 'packs.updates.field.weight',
  effort: 'readiness.effort',
  dateCertainty: 'readiness.dateCertainty',
  availableFrom: 'readiness.availableFrom',
  isBlocked: 'readiness.blocked',
};

function useFormatValue() {
  const { t, lang } = useI18n();
  const enumLabel = useEnumLabel();
  return (key: FieldKey, value: PackSharedFields[FieldKey] | undefined): string => {
    if (key === 'isBlocked') return value ? t('packs.updates.yes') : t('packs.updates.no');
    if (value === null || value === undefined || value === '') return t('packs.updates.none');
    const formatters: Record<FieldKey, () => string> = {
      title: () => String(value),
      date: () => formatTaskDate(String(value), lang),
      availableFrom: () => formatTaskDate(String(value), lang),
      weightPercentage: () => `${value}%`,
      effort: () => enumLabel(String(value)),
      dateCertainty: () => enumLabel(String(value)),
      isBlocked: () => String(value),
    };
    return formatters[key]();
  };
}

function PackUpdatesList({ updates, busyId, onAccept, onReject }: Props) {
  const { t } = useI18n();
  const format = useFormatValue();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async (id: string, action: (id: string) => Promise<string | null>) => {
    const message = await action(id);
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next[id] = message;
      else delete next[id];
      return next;
    });
  };

  return (
    <ul className="space-y-3">
      {updates.map((update) => {
        const keys = (Object.keys(update.changes) as FieldKey[]).filter((k) => k in FIELD_LABEL);
        const isBusy = busyId === update.id;
        return (
          <li key={update.id} className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4">
            <p className="font-medium text-white">{update.taskTitle}</p>
            <p className="mt-0.5 text-xs text-neutral-500">
              {t('packs.updates.from', { pack: update.packName, name: update.ownerName })}
            </p>
            <dl className="mt-3 space-y-1 text-sm">
              {keys.map((key) => (
                <div key={key} className="flex flex-wrap gap-x-2">
                  <dt className="text-neutral-400">{t(FIELD_LABEL[key])}:</dt>
                  <dd className="text-neutral-300">
                    <span className="line-through text-neutral-500">{format(key, update.current[key])}</span>
                    {' '}
                    <span className="text-violet-300">{format(key, update.changes[key])}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <FeedbackBanner
              feedback={errors[update.id] ? { type: 'error', message: errors[update.id] } : null}
              className="mt-3"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" disabled={isBusy} onClick={() => void run(update.id, onAccept)}>
                {t('packs.updates.accept')}
              </Button>
              <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => void run(update.id, onReject)}>
                {t('packs.updates.keepMine')}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default memo(PackUpdatesList);
