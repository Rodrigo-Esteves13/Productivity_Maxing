import Button from './Button';
import { useI18n } from '../../i18n/useI18n';

interface PaginationProps {
  total: number;
  skip: number;
  pageSize: number;
  onNextPage: () => void;
  onPrevPage: () => void;
}

// Rodapé "Showing X-Y of Z" com Previous/Next - extraído do
// SecurityLogsTable quando a página de Appeals passou a precisar do
// mesmo controlo (mesma convenção skip/take/total do backend, ver
// useSecurityLogsPage/useAppealsPage).
export default function Pagination({ total, skip, pageSize, onNextPage, onPrevPage }: PaginationProps) {
  const { t } = useI18n();
  if (total === 0) return null;

  const rangeStart = skip + 1;
  const rangeEnd = Math.min(skip + pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 text-sm text-neutral-400">
      <span>
        {t('common.showing', { from: rangeStart, to: rangeEnd, total })}
      </span>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" onClick={onPrevPage} disabled={skip === 0}>
          {t('common.previous')}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onNextPage}
          disabled={skip + pageSize >= total}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
