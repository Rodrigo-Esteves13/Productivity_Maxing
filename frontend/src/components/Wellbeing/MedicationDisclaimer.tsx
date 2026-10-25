import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import ErrorState from '../UI/ErrorState';
import { AlertTriangleIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

// Pontos do aviso legal, por ordem. Mudar o texto (ou a lista) obriga a
// subir MEDICATION_DISCLAIMER_VERSION no backend.
const DISCLAIMER_POINTS = [
  'notAdvice',
  'intendedPurpose',
  'onlyReminder',
  'combineAndDependence',
  'unknownToApp',
  'neverDecide',
  'canFail',
  'notMonitored',
  'personalUse',
  'emergency',
  'supportLines',
  'ownRisk',
  'disagree',
] as const;

// Texto completo do aviso, usado no ecra de aceitacao e para reler depois.
export function DisclaimerText() {
  const { t } = useI18n();
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-neutral-300">
      {DISCLAIMER_POINTS.map((point) => (
        <li key={point}>{t(`wellbeing.meds.disclaimer.${point}`)}</li>
      ))}
    </ol>
  );
}

interface MedicationDisclaimerGateProps {
  version: number;
  isSaving: boolean;
  onAccept: (version: number, locale: string) => Promise<boolean>;
}

// Antes de usar a medicacao: ler e aceitar o aviso. O backend recusa
// adicionar medicamentos ou registar tomas sem esta aceitacao.
export default function MedicationDisclaimerGate({ version, isSaving, onAccept }: MedicationDisclaimerGateProps) {
  const { t, lang } = useI18n();
  const [checked, setChecked] = useState(false);
  const [adult, setAdult] = useState(false);
  const [failed, setFailed] = useState(false);

  // Guarda a lingua em que o aviso foi lido, como prova do texto aceite.
  const accept = async () => {
    setFailed(!(await onAccept(version, lang)));
  };

  return (
    <div className="space-y-4 rounded-lg border border-red-900/60 bg-red-950/20 p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-red-300">
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
        {t('wellbeing.meds.disclaimer.title')}
      </p>
      <DisclaimerText />
      <p className="text-xs text-neutral-400">
        {t('wellbeing.meds.disclaimer.termsPrefix')}{' '}
        <Link to="/terms" className="text-violet-400 hover:text-violet-300">
          {t('wellbeing.meds.disclaimer.termsLink')}
        </Link>
      </p>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-100">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        {t('wellbeing.meds.disclaimer.checkbox')}
      </label>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-neutral-100">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 shrink-0 accent-violet-500"
          checked={adult}
          onChange={(e) => setAdult(e.target.checked)}
        />
        {t('wellbeing.meds.disclaimer.adult')}
      </label>
      {failed && <ErrorState message={t('wellbeing.meds.saveError')} />}
      <Button size="sm" disabled={!checked || !adult || isSaving} onClick={() => void accept()}>
        {isSaving ? t('common.saving') : t('wellbeing.meds.disclaimer.accept')}
      </Button>
    </div>
  );
}
