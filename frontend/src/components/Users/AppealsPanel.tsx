import { useState } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import UserStatusBadge from './UserStatusBadge';
import { useAppeals } from '../../hooks/useAppeals';
import type { AppealAdmin } from '../../types/models';

// Painel de admin em Users.tsx, acima da tabela - lista appeals
// pendentes (ver AppealsService.findAll no backend) com ações de
// Approve/Deny. Approve reaproveita reactivateUser() no backend (mesmo
// efeito do botão "Reactivate" na tabela abaixo); Deny só regista a
// decisão, a conta continua bloqueada.
export default function AppealsPanel() {
  const { appeals, isLoading, error, resolvingId, handleResolve } = useAppeals();

  if (isLoading || error || appeals.length === 0) {
    // Silencioso quando vazio/a carregar/em erro - isto é um extra acima
    // da tabela de users, não deve competir por atenção com o
    // ErrorState/TableSkeleton principal da página quando não há nada
    // para mostrar.
    return null;
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-900/60 bg-amber-950/20 p-4">
      <h2 className="text-sm font-semibold text-amber-400 mb-3">
        Pending appeals ({appeals.length})
      </h2>
      <div className="space-y-3">
        {appeals.map((appeal) => (
          <AppealRow
            key={appeal.id}
            appeal={appeal}
            isResolving={resolvingId === appeal.id}
            onResolve={handleResolve}
          />
        ))}
      </div>
    </div>
  );
}

interface AppealRowProps {
  appeal: AppealAdmin;
  isResolving: boolean;
  onResolve: (
    id: string,
    resolution: 'APPROVED' | 'DENIED',
    resolutionNote?: string,
  ) => Promise<void>;
}

function AppealRow({ appeal, isResolving, onResolve }: AppealRowProps) {
  const [note, setNote] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<'APPROVED' | 'DENIED' | null>(null);

  const confirm = (resolution: 'APPROVED' | 'DENIED') => {
    onResolve(appeal.id, resolution, note.trim() || undefined);
    setShowNoteFor(null);
    setNote('');
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-white font-medium">
            {appeal.user.name ?? appeal.user.email}
          </p>
          <p className="text-xs text-neutral-500">{appeal.user.email}</p>
        </div>
        <UserStatusBadge status={appeal.statusAtSubmission} />
      </div>

      {appeal.reasonAtSubmission && (
        <p className="mt-2 text-xs text-neutral-500">
          Original reason: {appeal.reasonAtSubmission}
        </p>
      )}

      <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap">{appeal.message}</p>
      <p className="mt-1 text-xs text-neutral-600">
        Submitted {new Date(appeal.createdAt).toLocaleString()}
      </p>

      {showNoteFor ? (
        <div className="mt-3">
          <Textarea
            label={`Note for the user (optional) - ${showNoteFor === 'APPROVED' ? 'approving' : 'denying'}`}
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isResolving}
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant={showNoteFor === 'APPROVED' ? 'primary' : 'secondary'}
              className={showNoteFor === 'DENIED' ? 'border-red-800 text-red-400' : ''}
              onClick={() => confirm(showNoteFor)}
              disabled={isResolving}
            >
              {isResolving
                ? 'Saving...'
                : `Confirm ${showNoteFor === 'APPROVED' ? 'approve' : 'deny'}`}
            </Button>
            <Button variant="secondary" onClick={() => setShowNoteFor(null)} disabled={isResolving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button onClick={() => setShowNoteFor('APPROVED')} disabled={isResolving}>
            Approve
          </Button>
          <Button
            variant="secondary"
            className="border-red-800 text-red-400"
            onClick={() => setShowNoteFor('DENIED')}
            disabled={isResolving}
          >
            Deny
          </Button>
        </div>
      )}
    </div>
  );
}
