import type { Area, AreaRatingField } from '../../types/models';
import { useAreaRatings } from '../../hooks/useAreaRatings';
import { useI18n } from '../../i18n/useI18n';
import RatingInput from '../UI/RatingInput';

interface AreaRatingsFieldProps {
  area: Area;
}

const FIELDS: { field: AreaRatingField; labelKey: string; hintKey: string }[] = [
  { field: 'teacherRating', labelKey: 'ratings.field.teacher', hintKey: 'ratings.field.teacherHint' },
  { field: 'courseLiking', labelKey: 'ratings.field.course', hintKey: 'ratings.field.courseHint' },
];

// "Gosto do docente / da cadeira" (1 a 5). Privado: so serve para medir,
// nos teus dados, a relacao com as notas (pagina Ratings).
export default function AreaRatingsField({ area }: AreaRatingsFieldProps) {
  const { t } = useI18n();
  const ratings = useAreaRatings(area.id);

  return (
    <div className="mt-6 border-t border-neutral-800 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t('ratings.field.title')}</p>
      <p className="mt-1 text-xs text-neutral-500">{t('ratings.field.help')}</p>
      <div className="mt-3 space-y-4">
        {FIELDS.map(({ field, labelKey, hintKey }) => {
          const value = ratings[field];
          return (
            <div key={field} className={ratings.isLoading || ratings.loadError ? 'pointer-events-none opacity-60' : undefined}>
              <p className="mb-1.5 text-sm text-neutral-200">{t(labelKey)}</p>
              <div className="flex flex-wrap items-center gap-3">
                <RatingInput value={value} onChange={(next) => void ratings.change(field, next)} hint={t(hintKey)} />
                {value !== null && (
                  <button
                    type="button"
                    onClick={() => void ratings.change(field, null)}
                    className="text-xs text-neutral-500 underline decoration-dotted hover:text-neutral-300"
                  >
                    {t('ratings.field.clear')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {ratings.loadError && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {t('ratings.field.loadError')}
        </p>
      )}
      {ratings.error && (
        <p role="alert" className="mt-2 text-xs text-red-400">
          {t('ratings.field.error')}
        </p>
      )}
    </div>
  );
}
