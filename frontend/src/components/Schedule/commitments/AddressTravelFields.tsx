import { useState } from 'react';
import Input from '../../UI/Input';
import Select from '../../UI/Select';
import { estimateCommitmentCommute } from '../../../api/commitmentsService';
import { getHttpStatus } from '../../../lib/httpError';
import { useI18n } from '../../../i18n/useI18n';
import type { CommuteMode } from '../../../types/models';

const MAX_ADDRESS_LENGTH = 300;
const HTTP_SERVICE_UNAVAILABLE = 503;

const COMMUTE_MODES: { value: CommuteMode; key: string }[] = [
  { value: 'WALKING', key: 'commitment.mode.walking' },
  { value: 'TRANSIT', key: 'commitment.mode.transit' },
  { value: 'BICYCLING', key: 'commitment.mode.bicycling' },
  { value: 'DRIVING', key: 'commitment.mode.driving' },
];

interface AddressTravelFieldsProps {
  address: string;
  onAddressChange: (value: string) => void;
  mode: CommuteMode;
  onModeChange: (value: CommuteMode) => void;
  // Minutos casa -> morada calculados pelo Google Maps (preenche o campo de
  // viagem do formulario que usa isto).
  onEstimated: (minutes: number) => void;
}

// Morada + meio de transporte + "Calcular automaticamente" (casa -> morada).
// Partilhado pelo formulario de locais (trabalho, ginasio) e pelo de eventos
// pontuais. A morada tambem serve ao itinerario do dia: entre duas coisas
// seguidas a app calcula a viagem direta em vez de mandar para casa.
export default function AddressTravelFields({
  address,
  onAddressChange,
  mode,
  onModeChange,
  onEstimated,
}: AddressTravelFieldsProps) {
  const { t } = useI18n();
  const [isCalculating, setIsCalculating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    setError('');
    setMessage('');
    if (!address.trim()) {
      setError(t('commitment.form.needAddress'));
      return;
    }
    setIsCalculating(true);
    try {
      const { commuteMinutes } = await estimateCommitmentCommute(address.trim(), mode);
      onEstimated(commuteMinutes);
      setMessage(t('commitment.form.calculated', { minutes: commuteMinutes }));
    } catch (caught) {
      setError(
        getHttpStatus(caught) === HTTP_SERVICE_UNAVAILABLE
          ? t('commitment.form.notConfigured')
          : t('commitment.form.calculateFailed'),
      );
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input
        label={t('commitment.form.address')}
        value={address}
        maxLength={MAX_ADDRESS_LENGTH}
        placeholder={t('commitment.form.addressPlaceholder')}
        onChange={(e) => onAddressChange(e.target.value)}
      />
      <Select
        label={t('commitment.form.mode')}
        value={mode}
        onChange={(e) => onModeChange(e.target.value as CommuteMode)}
        className="max-w-[14rem]"
      >
        {COMMUTE_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {t(m.key)}
          </option>
        ))}
      </Select>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleCalculate()}
          disabled={isCalculating}
          className="rounded-md border border-neutral-700 px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
        >
          {isCalculating ? t('commitment.form.calculating') : t('commitment.form.calculate')}
        </button>
        <p className="text-xs text-neutral-500">{t('commitment.form.calculateHelp')}</p>
      </div>
      {message && !error && <p className="text-sm text-violet-300">{message}</p>}
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
