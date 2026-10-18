import Skeleton from './Skeleton';
import { useI18n } from '../../i18n/useI18n';

// Larguras fixas (classes estaticas para o Tailwind as encontrar).
const WIDTHS = ['w-full', 'w-5/6', 'w-2/3'];

// Placeholder de texto/lista para dentro de cartoes e seccoes. Substitui o
// "Loading..." de texto: mostra a forma do conteudo e mantem a altura estavel.
export default function LinesSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-busy="true" className={`space-y-2.5 py-2 ${className}`}>
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${WIDTHS[i % WIDTHS.length]}`} />
      ))}
    </div>
  );
}
