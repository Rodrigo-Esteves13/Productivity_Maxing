import { useState } from 'react';
import ColorDot from '../UI/ColorDot';
import Button from '../UI/Button';
import type { AreaProposal } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';
import { useCatalogLabel } from '../../hooks/useCatalogLabel';

interface AreaProposalsPanelProps {
  proposals: AreaProposal[];
  onApprove: (proposal: AreaProposal) => void;
  onReject: (proposal: AreaProposal, note: string) => void;
}

// Fila do admin. Mostra só o que vai tornar-se público (nome, cor, créditos,
// tipo) e o nome de quem propôs.
export default function AreaProposalsPanel({ proposals, onApprove, onReject }: AreaProposalsPanelProps) {
  const { t } = useI18n();
  // Sem a lista de tipos aqui: os semeados saem traduzidos, os outros formatados.
  const { optionLabel } = useCatalogLabel();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState('');

  if (proposals.length === 0) return null;

  return (
    <section className="mb-8" aria-label={t('ui.areaProposals')}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400">
        {t('ui.proposalsToReview', { proposalsCount: proposals.length })}</h2>
      <ul className="space-y-2">
        {proposals.map((p) => (
          <li key={p.id} className="rounded-xl border border-amber-500/30 bg-neutral-900/50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <ColorDot color={p.colorHex} variant="circle" size="sm" />
                <span className="truncate font-medium text-white">{p.name}</span>
                <span className="text-xs text-neutral-500">
                  {p.credits !== null ? t('ui.nCredits', { count: p.credits }) : t('ui.noCreditsLower')}
                  {p.defaultTaskType ? ` · ${optionLabel('taskType', p.defaultTaskType, [])}` : ''}
                  {p.proposedBy ? ` · ${t('ui.byName', { name: p.proposedBy })}` : ''}
                </span>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onApprove(p)}>
                  {t('ui.approve')}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setRejectingId(rejectingId === p.id ? null : p.id);
                    setNote('');
                  }}
                >
                  {t('ui.reject')}
                </Button>
              </div>
            </div>
            {rejectingId === p.id && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('ui.reasonOptionalShownToThe')}
                  aria-label={t('ui.rejectionReason')}
                  className="min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    onReject(p, note);
                    setRejectingId(null);
                  }}
                >
                  {t('ui.confirmReject')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
