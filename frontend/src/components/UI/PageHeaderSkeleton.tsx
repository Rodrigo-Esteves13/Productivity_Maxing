import Skeleton from './Skeleton';

// Mesma forma do PageHeader: titulo, descricao e (opcional) um botao a direita.
export default function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div aria-hidden="true" className="mb-6 flex items-start justify-between gap-4 border-b border-neutral-800 pb-6">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-10 w-28 shrink-0 rounded-lg" />}
    </div>
  );
}
