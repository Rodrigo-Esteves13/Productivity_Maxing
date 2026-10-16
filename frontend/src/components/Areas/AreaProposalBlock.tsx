import Button from '../UI/Button';
import type { Area } from '../../types/models';

interface AreaProposalBlockProps {
  area: Area;
  onPropose: (area: Area) => void;
  onWithdraw: (area: Area) => void;
}

// Só para áreas pessoais do próprio user: propor à oficialização.
export default function AreaProposalBlock({ area, onPropose, onWithdraw }: AreaProposalBlockProps) {
  if (!area.isMine) return null;

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Make it official</p>
      {area.proposalStatus === 'PENDING' ? (
        <>
          <p className="mt-1 text-xs text-neutral-400">
            Waiting for an administrator to review. It cannot be edited meanwhile.
          </p>
          <div className="mt-2">
            <Button type="button" variant="secondary" onClick={() => onWithdraw(area)}>
              Withdraw proposal
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-600">
            Propose this area to everyone. Only its name, color, credits and type are shared; your tasks,
            grades and notes stay private.
          </p>
          {area.proposalStatus === 'REJECTED' && (
            <p className="mt-2 text-xs text-red-400">
              Not approved{area.proposalReviewNote ? `: ${area.proposalReviewNote}` : '.'} It stays personal;
              you can edit it and propose again.
            </p>
          )}
          <div className="mt-2">
            <Button type="button" variant="secondary" onClick={() => onPropose(area)}>
              {area.proposalStatus === 'REJECTED' ? 'Propose again' : 'Propose as official'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
