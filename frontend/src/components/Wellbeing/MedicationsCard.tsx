import { useState } from 'react';
import DashboardCard, { CardHeading } from '../UI/DashboardCard';
import EmptyState from '../UI/EmptyState';
import ErrorState from '../UI/ErrorState';
import IconButton from '../UI/IconButton';
import LinesSkeleton from '../UI/LinesSkeleton';
import Button from '../UI/Button';
import { BellIcon, ChevronLeftIcon, ChevronRightIcon, PencilIcon, PlusIcon, TrashIcon } from '../UI/Icons';
import MedicationForm from './MedicationForm';
import IntakeLogModal from './IntakeLogModal';
import MedicationDisclaimerGate, { DisclaimerText } from './MedicationDisclaimer';
import SupportLinesPanel from './SupportLinesPanel';
import MedicationPushWarning from './MedicationPushWarning';
import { formatClock, formatDateTime } from '../../lib/timeFormat';
import { useFeedback } from '../../context/useFeedback';
import { useI18n } from '../../i18n/useI18n';
import { MAX_DOSE_PAST_DAYS, type useMedications } from '../../hooks/useMedications';
import type { Medication, MedicationDaySlot, MedicationIntake } from '../../types/models';

interface MedicationsCardProps {
  meds: ReturnType<typeof useMedications>;
}

// null = nada aberto; 'new' = a adicionar; id = a editar esse.
type Editing = null | 'new' | string;

function DoseRow({ slot, onToggle }: { slot: MedicationDaySlot; onToggle: () => void }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-neutral-800/50 px-3 py-2">
        <input type="checkbox" className="h-4 w-4 accent-violet-500" checked={slot.taken} onChange={onToggle} />
        <span className="font-mono text-sm tabular-nums text-neutral-400">{formatClock(slot.slotMinutes)}</span>
        <span className={`min-w-0 flex-1 truncate text-sm ${slot.taken ? 'text-neutral-500 line-through' : 'text-neutral-100'}`}>
          {slot.name}
          {slot.dosage && <span className="text-neutral-500"> · {slot.dosage}</span>}
        </span>
      </label>
    </li>
  );
}

function IntakeRow({ intake, onDelete }: { intake: MedicationIntake; onDelete: () => void }) {
  const { t } = useI18n();
  return (
    <li className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 hover:bg-neutral-800/40">
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-100">
          {intake.name}
          {intake.dose && <span className="text-neutral-500"> · {intake.dose}</span>}
        </p>
        <p className="truncate text-xs tabular-nums text-neutral-500">
          {formatDateTime(intake.takenAt)}
          {intake.note && ` · ${intake.note}`}
        </p>
      </div>
      <IconButton label={t('wellbeing.meds.intake.delete')} tone="danger" onClick={onDelete}>
        <TrashIcon className="h-4 w-4" />
      </IconButton>
    </li>
  );
}

// Linha de detalhe de um medicamento na lista de gestao.
function scheduleSummary(m: Medication, t: ReturnType<typeof useI18n>['t']): string {
  const when = m.schedule === 'AS_NEEDED' ? t('wellbeing.meds.schedule.AS_NEEDED') : m.times.map(formatClock).join(', ');
  const parts = [when];
  if (!m.active) parts.push(t('wellbeing.meds.paused'));
  return parts.join(' · ');
}

// Medicacao: lembretes e registo das tomas. De proposito nao avalia doses,
// combinacoes nem dependencia: so lembra, regista e manda falar com o medico.
export default function MedicationsCard({ meds }: MedicationsCardProps) {
  const { t, lang } = useI18n();
  const { notify, confirm } = useFeedback();
  const [editing, setEditing] = useState<Editing>(null);
  const [logging, setLogging] = useState<Medication | null>(null);

  const reportFailure = (ok: boolean) => {
    if (!ok) notify(t('wellbeing.meds.saveError'), 'error');
  };

  const handleDelete = async (medication: Medication) => {
    const ok = await confirm({
      title: t('wellbeing.meds.deleteTitle'),
      message: t('wellbeing.meds.deleteMessage', { name: medication.name }),
      confirmLabel: t('wellbeing.meds.delete'),
      tone: 'danger',
    });
    if (ok) reportFailure(await meds.remove(medication.id));
  };

  const handleDeleteIntake = async (intake: MedicationIntake) => {
    const ok = await confirm({
      title: t('wellbeing.meds.intake.deleteTitle'),
      message: t('wellbeing.meds.intake.deleteMessage'),
      confirmLabel: t('wellbeing.meds.intake.delete'),
      tone: 'danger',
    });
    if (ok) reportFailure(await meds.removeIntake(intake.id));
  };

  const closeOnSuccess = (ok: boolean) => {
    if (ok) setEditing(null);
    return ok;
  };

  const hasDaily = meds.medications.some((m) => m.active && m.schedule === 'DAILY');
  const hasReminders = meds.medications.some((m) => m.active && m.schedule === 'DAILY' && m.remindersEnabled);
  const accepted = meds.disclaimer?.accepted ?? false;
  const asNeeded = meds.medications.filter((m) => m.active && m.schedule === 'AS_NEEDED');

  return (
    <DashboardCard>
      <div className="mb-1 flex items-center justify-between gap-2">
        <CardHeading>{t('wellbeing.meds.title')}</CardHeading>
        {accepted && editing === null && (
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            {t('wellbeing.meds.add')}
          </button>
        )}
      </div>
      <p className="mb-2 text-sm font-medium text-amber-300">{t('wellbeing.meds.alwaysAskDoctor')}</p>
      <p className="mb-4 text-xs text-neutral-500">{t('wellbeing.meds.legal')}</p>

      {meds.disclaimer && !accepted && (
        <MedicationDisclaimerGate
          version={meds.disclaimer.version}
          isSaving={meds.isSaving}
          onAccept={meds.acceptDisclaimer}
        />
      )}

      {accepted && <MedicationPushWarning hasReminders={hasReminders} />}

      {accepted && editing === 'new' && (
        <div className="mb-4">
          <MedicationForm
            isSaving={meds.isSaving}
            submitLabel={t('wellbeing.meds.add')}
            onSubmit={async (input) => closeOnSuccess(await meds.add(input))}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {meds.isLoading ? (
        <LinesSkeleton lines={3} />
      ) : meds.error ? (
        <ErrorState message={t('wellbeing.meds.loadError')} />
      ) : !accepted ? null : meds.medications.length === 0 ? (
        editing !== 'new' && <EmptyState variant="inline" message={t('wellbeing.meds.empty')} />
      ) : (
        <>
          {hasDaily && (
            <>
              {/* Setas para ir a um dia que passou e marcar a toma esquecida. */}
              <div className="mb-2 flex items-center gap-1">
                <IconButton
                  label={t('wellbeing.meds.prevDay')}
                  disabled={meds.dayOffset >= MAX_DOSE_PAST_DAYS}
                  onClick={() => meds.setDayOffset(meds.dayOffset + 1)}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </IconButton>
                <h3 className="min-w-[6rem] text-center text-sm font-medium text-neutral-200" aria-live="polite">
                  {meds.dayOffset === 0
                    ? t('wellbeing.meds.today')
                    : meds.dayOffset === 1
                      ? t('wellbeing.meds.yesterday')
                      : new Date(`${meds.dayKey}T12:00:00Z`).toLocaleDateString(lang, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                </h3>
                <IconButton
                  label={t('wellbeing.meds.nextDay')}
                  disabled={meds.dayOffset === 0}
                  onClick={() => meds.setDayOffset(meds.dayOffset - 1)}
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </IconButton>
                {meds.dayOffset > 0 && (
                  <button
                    type="button"
                    onClick={() => meds.setDayOffset(0)}
                    className="ml-auto text-xs font-medium text-violet-400 hover:text-violet-300"
                  >
                    {t('wellbeing.meds.backToToday')}
                  </button>
                )}
              </div>
              {meds.dayOffset > 0 && (
                <p className="mb-2 text-xs text-neutral-400">{t('wellbeing.meds.pastDayHint')}</p>
              )}
              {meds.slots.length === 0 ? (
                <EmptyState
                  variant="inline"
                  message={t(meds.dayOffset === 0 ? 'wellbeing.meds.nothingToday' : 'wellbeing.meds.nothingThisDay')}
                />
              ) : (
                <ul className="mb-5 space-y-1.5">
                  {meds.slots.map((slot) => (
                    <DoseRow
                      key={`${slot.medicationId}:${slot.slotMinutes}`}
                      slot={slot}
                      onToggle={() => void meds.toggleDose(slot).then(reportFailure)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}

          {(asNeeded.length > 0 || meds.intakes.length > 0) && (
            <>
              <h3 className="mb-2 text-sm font-medium text-neutral-200">{t('wellbeing.meds.asNeeded')}</h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {asNeeded.map((m) => (
                  <Button key={m.id} variant="secondary" size="sm" onClick={() => setLogging(m)}>
                    {t('wellbeing.meds.intake.logButton', { name: m.name })}
                  </Button>
                ))}
              </div>
              {meds.intakes.length === 0 ? (
                <EmptyState variant="inline" message={t('wellbeing.meds.intake.empty')} />
              ) : (
                <ul className="mb-5 space-y-1">
                  {meds.intakes.map((intake) => (
                    <IntakeRow key={intake.id} intake={intake} onDelete={() => void handleDeleteIntake(intake)} />
                  ))}
                </ul>
              )}
            </>
          )}

          <h3 className="mb-2 mt-5 text-sm font-medium text-neutral-200">{t('wellbeing.meds.manage')}</h3>
          <ul className="space-y-1.5">
            {meds.medications.map((m) =>
              editing === m.id ? (
                <li key={m.id}>
                  <MedicationForm
                    initial={m}
                    isSaving={meds.isSaving}
                    submitLabel={t('common.save')}
                    onSubmit={async (input) => closeOnSuccess(await meds.update(m.id, input))}
                    onCancel={() => setEditing(null)}
                  />
                </li>
              ) : (
                <li key={m.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-1.5 hover:bg-neutral-800/40">
                  <div className="min-w-0">
                    <p className={`truncate text-sm ${m.active ? 'text-neutral-100' : 'text-neutral-500'}`}>
                      {m.name}
                      {m.dosage && <span className="text-neutral-500"> · {m.dosage}</span>}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-neutral-500">
                      {m.remindersEnabled && m.schedule === 'DAILY' && (
                        <BellIcon className="h-3 w-3 shrink-0" aria-label={t('wellbeing.meds.reminders')} />
                      )}
                      <span className="truncate">{scheduleSummary(m, t)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void meds.update(m.id, { active: !m.active }).then(reportFailure)}
                      className="px-1.5 text-xs text-neutral-400 hover:text-white"
                    >
                      {m.active ? t('wellbeing.meds.pause') : t('wellbeing.meds.resume')}
                    </button>
                    <IconButton label={t('wellbeing.meds.edit')} onClick={() => setEditing(m.id)}>
                      <PencilIcon className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t('wellbeing.meds.delete')} tone="danger" onClick={() => void handleDelete(m)}>
                      <TrashIcon className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ),
            )}
          </ul>
        </>
      )}

      {/* Numeros de emergencia e apoio sempre visiveis, mesmo antes de aceitar. */}
      <div className="mt-5">
        <SupportLinesPanel />
      </div>

      {accepted && (
        <details className="mt-5 text-xs text-neutral-500">
          <summary className="cursor-pointer select-none hover:text-neutral-300">
            {t('wellbeing.meds.disclaimer.reread')}
          </summary>
          <div className="mt-2">
            <DisclaimerText />
          </div>
        </details>
      )}

      <IntakeLogModal
        medication={logging}
        isSaving={meds.isSaving}
        onSubmit={async (input) => {
          const ok = await meds.logIntake(input);
          if (ok) setLogging(null);
          return ok;
        }}
        onClose={() => setLogging(null)}
      />
    </DashboardCard>
  );
}
