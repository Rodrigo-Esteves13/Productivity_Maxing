import type { Area } from '../../types/models';
import { useAreaInterest } from '../../hooks/useAreaInterest';
import { useI18n } from '../../i18n/useI18n';
import { RATING_VALUES } from '../../lib/rating';

interface AreaInterestPickerProps {
  area: Area;
}

// "Quanto gostas desta cadeira?" (1 a 5). Privado: so serve para medir,
// nos teus dados, quanto o interesse pesa nas notas (cartao do Dashboard).
export default function AreaInterestPicker({ area }: AreaInterestPickerProps) {
  const { t } = useI18n();
  const { rating, isLoading, error, change } = useAreaInterest(area.id);

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('interest.label')}</p>
      <p className="mt-1 text-xs text-neutral-600">{t('interest.hint')}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label={t('interest.label')}>
        {RATING_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            disabled={isLoading}
            aria-pressed={rating === value}
            onClick={() => void change(rating === value ? null : value)}
            className={`h-8 w-8 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
              rating === value
                ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'
            }`}
          >
            {value}
          </button>
        ))}
        {rating !== null && (
          <button
            type="button"
            onClick={() => void change(null)}
            className="text-xs text-neutral-500 underline decoration-dotted hover:text-neutral-300"
          >
            {t('interest.clear')}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {t('interest.error')}
        </p>
      )}
    </div>
  );
}
