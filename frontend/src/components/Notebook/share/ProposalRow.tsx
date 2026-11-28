import { CheckIcon, XIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import { proposalChanges } from '../../../lib/shareProposal';
import type { ChangeProposal } from '../../../types/models';

// Uma alteracao proposta por um editor: o que muda (titulo / numero de
// caracteres) + o texto proposto escondido num <details>, e aprovar/recusar.
export default function ProposalRow({
  proposal,
  currentTitle,
  currentText,
  isDeciding,
  onDecide,
}: {
  proposal: ChangeProposal;
  currentTitle: string;
  currentText: string;
  isDeciding: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED') => void;
}) {
  const { t } = useI18n();
  const { title, textContent } = proposal.payload;
  const { titleChanged, textChanged, delta } = proposalChanges(proposal.payload, currentTitle, currentText);

  return (
    <li className="space-y-1.5 rounded-md border border-neutral-800 bg-neutral-950/60 p-2 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-neutral-200" title={proposal.proposedBy.name ?? proposal.proposedBy.email}>{proposal.proposedBy.name ?? proposal.proposedBy.email}</p>
          {proposal.note && <p className="text-neutral-500">“{proposal.note}”</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecide('APPROVED')}
            className="flex items-center gap-1 rounded-md bg-violet-500/15 px-2 py-1 text-violet-300 hover:bg-violet-500/25 disabled:opacity-50"
          >
            <CheckIcon className="h-3.5 w-3.5" />
            {t('share.proposals.approve')}
          </button>
          <button
            type="button"
            disabled={isDeciding}
            onClick={() => onDecide('REJECTED')}
            className="flex items-center gap-1 rounded-md bg-red-500/15 px-2 py-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
          >
            <XIcon className="h-3.5 w-3.5" />
            {t('share.proposals.reject')}
          </button>
        </div>
      </div>

      {titleChanged && (
        <p className="text-neutral-400">{t('share.proposals.titleChange', { from: currentTitle, to: title ?? '' })}</p>
      )}
      {textChanged && (
        <details>
          <summary className="cursor-pointer text-neutral-400 hover:text-neutral-200">
            {t('share.proposals.textChange', { delta })}
          </summary>
          <p className="mt-1.5 max-h-48 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-neutral-900 p-2 text-neutral-300">
            {textContent}
          </p>
        </details>
      )}
      {!titleChanged && !textChanged && <p className="text-neutral-500">{t('share.proposals.noChange')}</p>}
    </li>
  );
}
