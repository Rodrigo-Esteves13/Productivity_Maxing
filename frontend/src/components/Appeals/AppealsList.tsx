import AppealRow from './AppealRow';
import Pagination from '../UI/Pagination';
import EmptyState from '../UI/EmptyState';
import type { AppealAdmin, AppealResolution } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface AppealsListProps {
  appeals: AppealAdmin[];
  total: number;
  skip: number;
  pageSize: number;
  onResolve: (id: string, resolution: AppealResolution, resolutionNote?: string) => Promise<void>;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function AppealsList({
  appeals,
  total,
  skip,
  pageSize,
  onResolve,
  onNextPage,
  onPrevPage,
}: AppealsListProps) {
  const { t } = useI18n();
  if (appeals.length === 0) {
    return <EmptyState message={t('ui.noPendingAppealsRightNow')} />;
  }

  return (
    <div className="space-y-3">
      {appeals.map((appeal) => (
        <AppealRow key={appeal.id} appeal={appeal} onResolve={onResolve} />
      ))}

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
        <Pagination total={total} skip={skip} pageSize={pageSize} onNextPage={onNextPage} onPrevPage={onPrevPage} />
      </div>
    </div>
  );
}
