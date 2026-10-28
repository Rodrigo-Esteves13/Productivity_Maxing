import { useMemo, useState, type FormEvent } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import Button from '../UI/Button';
import Input from '../UI/Input';
import Select from '../UI/Select';
import FormError from '../UI/FormError';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import IconButton from '../UI/IconButton';
import { TrashIcon } from '../UI/Icons';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import { createBloodDonation, deleteBloodDonation, getBloodDonations } from '../../api/wellbeingService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useLisbonToday } from '../../hooks/useLisbonToday';
import { useTurmaAction } from '../../hooks/useTurmas';
import { useI18n } from '../../i18n/useI18n';
import type { BloodDonationType } from '../../types/models';

const TYPES: { value: BloodDonationType; labelKey: string }[] = [
  { value: 'WHOLE_BLOOD', labelKey: 'wellbeing.blood.type.wholeBlood' },
  { value: 'PLASMA', labelKey: 'wellbeing.blood.type.plasma' },
  { value: 'PLATELETS', labelKey: 'wellbeing.blood.type.platelets' },
];
const TYPE_LABEL_KEY = Object.fromEntries(TYPES.map((t) => [t.value, t.labelKey])) as Record<BloodDonationType, string>;
const LOCATION_MAX_LENGTH = 120;

// Registo das dadivas de sangue: historico, quantas este ano e quando foi
// a ultima. Quando se pode voltar a doar fica com o servico de
// sangue (a app nao da conselhos medicos).
export default function BloodDonationsCard() {
  const { t } = useI18n();
  const today = useLisbonToday();
  const { data: donations, isLoading, error, reload } = useLoadOnce(getBloodDonations);
  const save = useTurmaAction(createBloodDonation, t('wellbeing.blood.saveError'));
  const confirm = useConfirmAction(t('wellbeing.blood.saveError'));
  const [isAdding, setIsAdding] = useState(false);
  const [date, setDate] = useState(today);
  const [type, setType] = useState<BloodDonationType>('WHOLE_BLOOD');
  const [location, setLocation] = useState('');

  const stats = useMemo(() => {
    if (!donations || donations.length === 0) return null;
    const year = today.slice(0, 4);
    const last = donations[0];
    return {
      total: donations.length,
      thisYear: donations.filter((d) => d.date.startsWith(year)).length,
      lastDate: last.date,
    };
  }, [donations, today]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const created = await save.execute({ date, type, location: location.trim() || undefined });
    if (created) {
      setIsAdding(false);
      setLocation('');
      reload();
    }
  };

  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between gap-2">
        <CardHeading>{t('wellbeing.blood.title')}</CardHeading>
        <Button size="sm" variant="secondary" onClick={() => setIsAdding((v) => !v)}>
          {isAdding ? t('ui.cancel') : t('wellbeing.blood.add')}
        </Button>
      </div>

      {isAdding && (
        <form onSubmit={(e) => void handleSubmit(e)} className="mb-4 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="date"
              required
              max={today}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t('wellbeing.blood.date')}
            />
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as BloodDonationType)}
              aria-label={t('wellbeing.blood.typeLabel')}
            >
              {TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
          </div>
          <Input
            value={location}
            maxLength={LOCATION_MAX_LENGTH}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('wellbeing.blood.location')}
            aria-label={t('wellbeing.blood.location')}
          />
          {save.error && <FormError message={save.error} />}
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={save.isBusy || !date}>
              {t('wellbeing.blood.save')}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <LinesSkeleton lines={3} />
      ) : error ? (
        <ErrorState message={t('wellbeing.blood.loadError')} />
      ) : !donations || donations.length === 0 ? (
        <EmptyState message={t('wellbeing.blood.empty')} />
      ) : (
        <>
          {stats && (
            <p className="mb-3 text-sm text-neutral-300">
              {t('wellbeing.blood.summary', {
                total: stats.total,
                thisYear: stats.thisYear,
                date: stats.lastDate,
              })}
            </p>
          )}
          <ul className="divide-y divide-neutral-800">
            {donations.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-neutral-200">
                    {d.date} · {t(TYPE_LABEL_KEY[d.type])}
                  </p>
                  {d.location && <p className="truncate text-xs text-neutral-500">{d.location}</p>}
                </div>
                <IconButton
                  label={t('wellbeing.blood.delete')}
                  tone="danger"
                  onClick={() =>
                    confirm.request({
                      title: t('wellbeing.blood.delete'),
                      message: t('wellbeing.blood.deleteConfirm', { date: d.date }),
                      confirmLabel: t('common.delete'),
                      tone: 'danger',
                      run: async () => {
                        await deleteBloodDonation(d.id);
                        reload();
                      },
                    })
                  }
                >
                  <TrashIcon />
                </IconButton>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-3 text-[11px] text-neutral-500">{t('wellbeing.blood.caveat')}</p>
      <ConfirmActionDialog state={confirm} />
    </DashboardCard>
  );
}
