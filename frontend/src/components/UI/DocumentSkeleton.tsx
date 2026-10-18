import Skeleton from './Skeleton';
import { useI18n } from '../../i18n/useI18n';

const WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-3/4'];

// Paginas de texto (politicas, aulas partilhadas, changelog): titulo + paragrafos.
export default function DocumentSkeleton({ paragraphs = 3 }: { paragraphs?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className="max-w-3xl space-y-6">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-8 w-2/3" />
      {Array.from({ length: paragraphs }).map((_, p) => (
        <div key={p} className="space-y-2.5">
          {WIDTHS.map((width, i) => (
            <Skeleton key={i} className={`h-4 ${width}`} />
          ))}
        </div>
      ))}
    </div>
  );
}
