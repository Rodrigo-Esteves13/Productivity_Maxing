import { useState } from 'react';
import ActionButton from '../UI/ActionButton';
import ErrorState from '../UI/ErrorState';
import LoadingState from '../UI/LoadingState';
import EmptyState from '../UI/EmptyState';
import { PlusIcon } from '../UI/Icons';
import { useCommitments } from '../../hooks/useCommitments';
import CommitmentForm from './commitments/CommitmentForm';
import CommitmentSection from './commitments/CommitmentSection';
import CopyWeekPanel from './commitments/CopyWeekPanel';
import EventsSection from './commitments/EventsSection';

interface CommitmentsCardProps {
  onChanged: () => void;
}

export default function CommitmentsCard({ onChanged }: CommitmentsCardProps) {
  const {
    overview, isLoading, isSaving, error, clearError,
    addCommitment, editCommitment, removeCommitment, addShifts, editShift, removeShift,
    copyWeek, copyResult, clearCopyResult,
  } = useCommitments(onChanged);
  const [isCreating, setIsCreating] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  const { commitments, ungroupedShifts } = overview;

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 sm:p-6 mt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Work and other commitments</h2>
          <p className="text-sm text-neutral-400">
            Create a place once (work, gym...) with its travel time, then add its shifts, or add a
            one-off event. The study plan and Google Calendar both schedule around them.
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
              Copy a week
            </button>
            <ActionButton onClick={() => { clearError(); setIsCreating(true); }} className="flex items-center gap-2">
              <PlusIcon />
              New
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
            submitLabel="Create"
            isSaving={isSaving}
            onSubmit={async (name, commuteMinutes) => {
              const ok = await addCommitment(name, commuteMinutes);
              if (ok) setIsCreating(false);
              return ok;
            }}
            onCancel={() => setIsCreating(false)}
          />
        </div>
      )}

      {error && <ErrorState message={error} />}
      {isLoading && <LoadingState message="Loading commitments..." className="py-4" />}

      {!isLoading && commitments.length === 0 && ungroupedShifts.length === 0 && !isCreating && (
        <EmptyState message="Nothing here yet. Create a place like work or the gym, or add a one-off event below." />
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
    </div>
  );
}
