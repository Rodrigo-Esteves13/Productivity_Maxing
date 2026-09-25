import { useState } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import UserStatusBadge from '../Users/UserStatusBadge';
import type { AppealAdmin, AppealResolution, UserStatus } from '../../types/models';

interface AppealRowProps {
  appeal: AppealAdmin;
  isResolving: boolean;
  onResolve: (id: string, resolution: AppealResolution, resolutionNote?: string) => Promise<void>;
}

// Faixa lateral colorida por severidade - mesma cor que UserStatusBadge já
// usa para BANNED/SUSPENDED, só que aqui carrega a informação sem precisar
// de outra borda inteira à volta do cartão. ACTIVE não deveria acontecer
// (um appeal só existe enquanto a conta está restringida), mas o tipo
// UserStatus inclui-o, daí o fallback neutro.
const ACCENT: Record<UserStatus, string> = {
  BANNED: 'border-l-red-600',
  SUSPENDED: 'border-l-amber-500',
  ACTIVE: 'border-l-neutral-700',
};

export default function AppealRow({ appeal, isResolving, onResolve }: AppealRowProps) {
  const [note, setNote] = useState('');
  const [showNoteFor, setShowNoteFor] = useState<AppealResolution | null>(null);

  const confirm = (resolution: AppealResolution) => {
    onResolve(appeal.id, resolution, note.trim() || undefined);
    setShowNoteFor(null);
    setNote('');
  };

  return (
    <div
      className={`rounded-lg border-y border-r border-neutral-800 bg-neutral-900 p-4 border-l-4 ${ACCENT[appeal.statusAtSubmission]}`}
    >
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
        <p className="mt-3 text-xs text-neutral-500">
          Original reason: {appeal.reasonAtSubmission}
        </p>
      )}

      <p className="mt-2 text-sm text-neutral-300 whitespace-pre-wrap leading-relaxed">
        {appeal.message}
      </p>
      <p className="mt-2 text-xs text-neutral-600">
        Submitted {new Date(appeal.createdAt).toLocaleString()}
      </p>

      {showNoteFor ? (
        <div className="mt-4">
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
        <div className="mt-4 flex gap-2">
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
