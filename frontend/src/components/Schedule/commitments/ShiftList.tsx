import { useMemo, useState } from 'react';
import ShiftRow from './ShiftRow';
import { orderShiftsByOccurrence } from '../../../lib/shiftOrder';
import { todayUtcAnchored } from '../../../lib/weekDates';
import type { Commitment, UpdateWorkShiftInput, WorkShift } from '../../../types/models';

interface ShiftListProps {
  shifts: WorkShift[];
  isSaving: boolean;
  onEdit: (id: string, changes: UpdateWorkShiftInput) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  moveTargets?: Commitment[];
  // Mostra o titulo (label) de cada turno; usado nos eventos, onde o titulo e o que importa.
  showTitle?: boolean;
  className?: string;
}

// Lista de turnos por ordem de ocorrencia. Os pontuais que ja passaram
// ficam escondidos (arquivados) atras de "Show past", para a lista nao
// encher de coisas que ja aconteceram.
export default function ShiftList({
  shifts,
  isSaving,
  onEdit,
  onDelete,
  moveTargets,
  showTitle = false,
  className = '',
}: ShiftListProps) {
  const [showPast, setShowPast] = useState(false);
  const { upcoming, past } = useMemo(() => orderShiftsByOccurrence(shifts, todayUtcAnchored()), [shifts]);

  const renderRow = (shift: WorkShift) => (
    <ShiftRow
      key={shift.id}
      shift={shift}
      isSaving={isSaving}
      onEdit={onEdit}
      onDelete={onDelete}
      moveTargets={moveTargets}
      showTitle={showTitle}
    />
  );

  if (upcoming.length === 0 && past.length === 0) return null;

  return (
    <div className={className}>
      {upcoming.length > 0 && <ul className="space-y-1.5">{upcoming.map(renderRow)}</ul>}
      {upcoming.length === 0 && <p className="text-xs text-neutral-500">Nothing coming up.</p>}

      {past.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast((open) => !open)}
            className="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
          >
            {showPast ? 'Hide past' : `Show past (${past.length})`}
          </button>
          {showPast && <ul className="mt-1.5 space-y-1.5 opacity-60">{past.map(renderRow)}</ul>}
        </>
      )}
    </div>
  );
}
