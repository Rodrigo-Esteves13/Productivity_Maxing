import { useState } from 'react';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import LinesSkeleton from '../UI/LinesSkeleton';
import EmptyState from '../UI/EmptyState';
import { PlusIcon } from '../UI/Icons';
import { useCommitments } from '../../hooks/useCommitments';
import CommitmentForm from './commitments/CommitmentForm';
import CommitmentSection from './commitments/CommitmentSection';
import { useI18n } from '../../i18n/useI18n';
import CopyWeekPanel from './commitments/CopyWeekPanel';
import EventsSection from './commitments/EventsSection';
import Card from '../UI/Card';

interface CommitmentsCardProps {
  onChanged: () => void;
}

export default function CommitmentsCard({ onChanged }: CommitmentsCardProps) {
  const { t } = useI18n();
  const {
    overview, isLoading, isSaving, error, clearError,
    addCommitment, editCommitment, removeCommitment, addShifts, editShift, removeShift,
    copyWeek, copyResult, clearCopyResult,
  } = useCommitments(onChanged);
  const [isCreating, setIsCreating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const { commitments, ungroupedShifts } = overview;

  return (
    <Card className="mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">{t('ui.workAndOtherCommitments')}</h2>
          <p className="text-sm text-neutral-400">
            {t('ui.createAPlaceOnceWork')}
          </p>
        </div>
        {!isCreating && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { clearError(); clearCopyResult(); setIsCopying((open) => !open); }}
              aria-expanded={isCopying}
              className="px-3 py-2 text-sm text-neutral-300 hover:text-white border border-neutral-700 rounded-md"
            >
              {t('ui.copyAWeek')}
            </button>
            <ActionButton onClick={() => { clearError(); setIsCreating(true); }} className="flex items-center gap-2">
              <PlusIcon />
              {t('ui.new')}
            </ActionButton>
          </div>
        )}
      </div>

      {isCopying && (
        <CopyWeekPanel
          isSaving={isSaving}
          result={copyResult}
          onCopy={copyWeek}
          onClose={() => { clearCopyResult(); setIsCopying(false); }}
        />
      )}

      {isCreating && (
        <div className="mb-4">
          <CommitmentForm
            submitLabel={t('commitment.create')}
            isSaving={isSaving}
            onSubmit={async (values) => {
              const ok = await addCommitment(values);
              if (ok) setIsCreating(false);
              return ok;
            }}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      )}

      {error && <ErrorState message={error} />}
      {isLoading && <LinesSkeleton lines={3} />}

      {!isLoading && commitments.length === 0 && ungroupedShifts.length === 0 && !isCreating && (
        <EmptyState variant="inline" message={t('ui.nothingHereYetCreateA')} />
      )}

      <div className="space-y-3">
        {commitments.map((commitment) => (
          <CommitmentSection
            key={commitment.id}
            commitment={commitment}
            isSaving={isSaving}
            onEditCommitment={editCommitment}
            onDeleteCommitment={removeCommitment}
            onAddShifts={addShifts}
            onEditShift={editShift}
            onDeleteShift={removeShift}
          />
        ))}

        <EventsSection
          shifts={ungroupedShifts}
          commitments={commitments}
          isSaving={isSaving}
          onAdd={addShifts}
          onEdit={editShift}
          onDelete={removeShift}
        />
      </div>
    </Card>
  );
}
