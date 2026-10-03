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
import ShiftRow from './commitments/ShiftRow';

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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">Work and other commitments</h2>
          <p className="text-sm text-neutral-400">
            Create a place once (work, gym...) with its travel time, then add its shifts.
            The study plan and Google Calendar both schedule around them.
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
        <EmptyState message="Nothing here yet. Create your first place, like your job or the gym." />
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

        {ungroupedShifts.length > 0 && (
          <section className="rounded-xl border border-dashed border-neutral-700 p-4">
            <h3 className="text-base font-semibold text-white">Ungrouped shifts</h3>
            <p className="text-xs text-neutral-500 mb-3">
              Added before places existed. Move each one into a place to group it.
            </p>
            <ul className="space-y-1.5">
              {ungroupedShifts.map((shift) => (
                <ShiftRow
                  key={shift.id}
                  shift={shift}
                  isSaving={isSaving}
                  onEdit={editShift}
                  onDelete={removeShift}
                  moveTargets={commitments}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
