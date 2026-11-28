import Button from '../UI/Button';
import type { ApprovalRulesScope } from '../../lib/approvalRules';
import { useI18n } from '../../i18n/useI18n';

interface ApprovalRulesActionsProps {
  scope: ApprovalRulesScope;
  isBulk: boolean;
  isBusy: boolean;
  onReset: () => void;
  onApplyAll: () => void;
  onClose: () => void;
}

// Botoes do fundo do modal (gravar e uma submissao do formulario).
export default function ApprovalRulesActions({
  scope,
  isBulk,
  isBusy,
  onReset,
  onApplyAll,
  onClose,
}: ApprovalRulesActionsProps) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap justify-between gap-2 pt-2">
      {isBulk ? (
        <span />
      ) : (
        <Button type="button" variant="secondary" onClick={onReset} disabled={isBusy}>
          {t(`approvalRules.reset.${scope}`)}
        </Button>
      )}
      <div className="flex flex-wrap gap-2">
        {!isBulk && (
          <Button type="button" variant="secondary" onClick={onApplyAll} disabled={isBusy}>
            {t('approvalRules.applyAll')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        {isBulk ? (
          <Button type="button" onClick={onApplyAll} disabled={isBusy}>
            {isBusy ? t('common.saving') : t('areas.select.setRules')}
          </Button>
        ) : (
          <Button type="submit" disabled={isBusy}>
            {isBusy ? t('common.saving') : t('approvalRules.save')}
          </Button>
        )}
      </div>
    </div>
  );
}
