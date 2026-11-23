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
import { PencilIcon, TrashIcon } from '../UI/Icons';
import BloodDonationEditModal from './BloodDonationEditModal';
import ConfirmActionDialog from '../Turma/ConfirmActionDialog';
import { useConfirmAction } from '../../hooks/useConfirmAction';
import {
  createBloodDonation,
  deleteBloodDonation,
  getBloodDonations,
  updateBloodDonation,
} from '../../api/wellbeingService';
import { useLoadOnce } from '../../hooks/useLoadOnce';
import { useLisbonToday } from '../../hooks/useLisbonToday';
import { useTurmaAction } from '../../hooks/useTurmas';
import { useI18n } from '../../i18n/useI18n';
import { useFeedback } from '../../context/useFeedback';
import type { BloodDonation, BloodDonationType } from '../../types/models';

const TYPES: { value: BloodDonationType; labelKey: string }[] = [
  { value: 'WHOLE_BLOOD', labelKey: 'wellbeing.blood.type.wholeBlood' },
  { value: 'PLASMA', labelKey: 'wellbeing.blood.type.plasma' },
  { value: 'PLATELETS', labelKey: 'wellbeing.blood.type.platelets' },
];
const TYPE_LABEL_KEY = Object.fromEntries(TYPES.map((t) => [t.value, t.labelKey])) as Record<BloodDonationType, string>;
const LOCATION_MAX_LENGTH = 120;
// Quantas dadivas se mostram de cada vez; "ver mais" mostra outras tantas.
const DONATIONS_PAGE_SIZE = 10;
const NOON_UTC_SUFFIX = 'T12:00:00Z';

// Registo das dadivas de sangue: historico, quantas este ano e quando foi
// a ultima. Quando se pode voltar a doar fica com o servico de
// sangue (a app nao da conselhos medicos).
export default function BloodDonationsCard() {
  const { t, lang } = useI18n();
  const today = useLisbonToday();
  const { data: donations, isLoading, error, reload } = useLoadOnce(getBloodDonations);
  const { notify } = useFeedback();
  const save = useTurmaAction(createBloodDonation, t('wellbeing.blood.saveError'));
  const edit = useTurmaAction(updateBloodDonation, t('wellbeing.blood.saveError'));
  const [editing, setEditing] = useState<BloodDonation | null>(null);
  const [visible, setVisible] = useState(DONATIONS_PAGE_SIZE);
  // YYYY-MM-DD -> data na lingua da app (UTC, sem deslocar o dia).
  const formatDay = (key: string) =>
    new Date(`${key.slice(0, 10)}${NOON_UTC_SUFFIX}`).toLocaleDateString(lang, { timeZone: 'UTC' });
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

  const handleEdit = async (id: string, changes: Parameters<typeof updateBloodDonation>[1]) => {
    const updated = await edit.execute(id, changes);
    if (updated) {
      setEditing(null);
      reload();
      notify(t('ux4well.blood.edited'), 'success');
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
        <ErrorState message={t('wellbeing.blood.loadError')} onRetry={reload} />
      ) : !donations || donations.length === 0 ? (
        <EmptyState message={t('wellbeing.blood.empty')} />
      ) : (
        <>
          {stats && (
            <p className="mb-3 text-sm text-neutral-300">
              {t('wellbeing.blood.summary', {
                total: stats.total,
                thisYear: stats.thisYear,
                date: formatDay(stats.lastDate),
              })}
            </p>
          )}
          <ul className="divide-y divide-neutral-800">
            {donations.slice(0, visible).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="text-neutral-200">
                    {formatDay(d.date)} · {t(TYPE_LABEL_KEY[d.type])}
                  </p>
                  {d.location && (
                    <p className="truncate text-xs text-neutral-500" title={d.location}>
                      {d.location}
                    </p>
                  )}
                  {d.note && (
                    <p className="truncate text-xs text-neutral-500" title={d.note}>
                      {d.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                <IconButton
                  label={t('ux4well.blood.edit')}
                  onClick={() => {
                    edit.clearError();
                    setEditing(d);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={t('wellbeing.blood.delete')}
                  tone="danger"
                  onClick={() =>
                    confirm.request({
                      title: t('wellbeing.blood.delete'),
                      message: t('wellbeing.blood.deleteConfirm', { date: formatDay(d.date) }),
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
                </div>
              </li>
            ))}
          </ul>
          {donations.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((n) => n + DONATIONS_PAGE_SIZE)}
              className="mt-2 min-h-8 text-xs font-medium text-violet-400 hover:text-violet-300 pointer-coarse:min-h-11"
            >
              {t('ux4well.blood.showMore', { shown: visible, total: donations.length })}
            </button>
          )}
        </>
      )}
      <p className="mt-3 text-[11px] text-neutral-500">{t('wellbeing.blood.caveat')}</p>
      <BloodDonationEditModal
        donation={editing}
        types={TYPES}
        today={today}
        isBusy={edit.isBusy}
        error={edit.error}
        onSubmit={handleEdit}
        onClose={() => setEditing(null)}
      />
      <ConfirmActionDialog state={confirm} />
    </DashboardCard>
  );
}
