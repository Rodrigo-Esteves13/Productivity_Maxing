import { TargetIcon } from '../UI/Icons';
import Button from '../UI/Button';
import { useI18n } from '../../i18n/useI18n';

interface Props {
  onTurnOff: () => void;
}

// Aviso fixo enquanto o modo plano esta ligado: os numeros do Dashboard nao
// sao as notas reais, e isso tem de ser impossivel de nao ver.
export default function PlanModeBanner({ onTurnOff }: Props) {
  const { t } = useI18n();
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-800 bg-violet-950/40 p-4"
    >
      <div className="flex min-w-0 items-start gap-2">
        <TargetIcon className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-violet-200">{t('planMode.bannerTitle')}</p>
          <p className="text-xs text-neutral-400">{t('planMode.bannerBody')}</p>
        </div>
      </div>
      <Button size="sm" variant="secondary" onClick={onTurnOff}>
        {t('planMode.turnOff')}
      </Button>
    </div>
  );
}
