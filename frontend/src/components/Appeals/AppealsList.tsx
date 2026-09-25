import AppealRow from './AppealRow';
import Pagination from '../UI/Pagination';
import EmptyState from '../UI/EmptyState';
import type { AppealAdmin, AppealResolution } from '../../types/models';

interface AppealsListProps {
  appeals: AppealAdmin[];
  total: number;
  skip: number;
  pageSize: number;
  resolvingId: string | null;
  onResolve: (id: string, resolution: AppealResolution, resolutionNote?: string) => Promise<void>;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export default function AppealsList({
  appeals,
  total,
  skip,
  pageSize,
  resolvingId,
  onResolve,
  onNextPage,
  onPrevPage,
}: AppealsListProps) {
  if (appeals.length === 0) {
    return <EmptyState message="No pending appeals right now - new ones will show up here." />;
  }

  return (
    <div className="space-y-3">
      {appeals.map((appeal) => (
        <AppealRow
          key={appeal.id}
          appeal={appeal}
          isResolving={resolvingId === appeal.id}
          onResolve={onResolve}
        />
      ))}

      <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl overflow-hidden">
        <Pagination total={total} skip={skip} pageSize={pageSize} onNextPage={onNextPage} onPrevPage={onPrevPage} />
      </div>
    </div>
  );
}
