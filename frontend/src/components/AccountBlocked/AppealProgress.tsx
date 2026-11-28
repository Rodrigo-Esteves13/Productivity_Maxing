import { useI18n } from '../../i18n/useI18n';
import { fillNodes } from '../../i18n/fillNodes';
import type { AppealAvailability } from '../../types/models';

interface AppealProgressProps {
  availability: AppealAvailability;
  accentText: string;
  isBanned: boolean;
}

// Indicador visual de "quantos dos 3 appeals já foram usados" - o tipo de
// stepper que a maioria dos ecrãs de suspensão/ban mostra (contagem
// clara em vez de o utilizador ter de adivinhar quantas tentativas
// ainda tem).
export default function AppealProgress({ availability, accentText, isBanned }: AppealProgressProps) {
  const { t } = useI18n();
  const filledClass = isBanned ? 'bg-red-600' : 'bg-amber-500';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: availability.maxAppeals }).map((_, index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < availability.appealsUsed ? filledClass : 'bg-neutral-800'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        {fillNodes(t('ui.appealsUsedOf', { max: availability.maxAppeals }), {
          used: <span className={accentText}>{availability.appealsUsed}</span>,
        })}
      </p>
    </div>
  );
}
