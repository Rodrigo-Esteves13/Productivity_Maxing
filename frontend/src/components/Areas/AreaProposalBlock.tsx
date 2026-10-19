import Button from '../UI/Button';
import type { Area } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface AreaProposalBlockProps {
  area: Area;
  onPropose: (area: Area) => void;
  onWithdraw: (area: Area) => void;
}

// Só para áreas pessoais do próprio user: propor à oficialização.
export default function AreaProposalBlock({ area, onPropose, onWithdraw }: AreaProposalBlockProps) {
  const { t } = useI18n();
  if (!area.isMine) return null;

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('ui.makeItOfficial')}</p>
      {area.proposalStatus === 'PENDING' ? (
        <>
          <p className="mt-1 text-xs text-neutral-400">
            {t('ui.waitingForAnAdministratorTo')}
          </p>
          <div className="mt-2">
            <Button type="button" variant="secondary" onClick={() => onWithdraw(area)}>
              {t('ui.withdrawProposal')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs text-neutral-600">
            {t('ui.proposeThisAreaToEveryone')}
          </p>
          {area.proposalStatus === 'REJECTED' && (
            <p className="mt-2 text-xs text-red-400">
              {area.proposalReviewNote
                ? t('ui.proposalNotApprovedNote', { note: area.proposalReviewNote })
                : t('ui.proposalNotApproved')}
            </p>
          )}
          <div className="mt-2">
            <Button type="button" variant="secondary" onClick={() => onPropose(area)}>
              {area.proposalStatus === 'REJECTED' ? t('ui.proposeAgain') : t('ui.proposeAsOfficial')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
