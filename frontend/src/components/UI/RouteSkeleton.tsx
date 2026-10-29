import { useLocation } from 'react-router-dom';
import PageLayout from '../Layout/PageLayout';
import CardGridSkeleton from './CardGridSkeleton';
import DocumentSkeleton from './DocumentSkeleton';
import FormSkeleton from './FormSkeleton';
import PageHeaderSkeleton from './PageHeaderSkeleton';
import Skeleton from './Skeleton';
import TableSkeleton from './TableSkeleton';
import { useI18n } from '../../i18n/useI18n';

type Variant = 'dashboard' | 'cards' | 'table' | 'week' | 'notebook' | 'profile' | 'document';

// Forma do ecra que vai aparecer, por prefixo de rota (a primeira que bate
// ganha). Rotas sem entrada usam 'cards'. Fica aqui UM mapa em vez de um
// Suspense por rota.
const VARIANT_BY_PREFIX: [string, Variant][] = [
  ['/dashboard', 'dashboard'],
  ['/tasks', 'cards'],
  ['/task-packs', 'table'],
  ['/packs', 'table'],
  ['/schedule', 'week'],
  ['/notebook', 'notebook'],
  ['/profile', 'profile'],
  ['/users', 'table'],
  ['/security', 'table'],
  ['/appeals', 'table'],
  ['/feedback', 'table'],
  ['/friend-code-requests', 'table'],
  ['/task-types', 'table'],
  ['/privacy', 'document'],
  ['/terms', 'document'],
  ['/eula', 'document'],
  ['/dmca', 'document'],
  ['/changelog', 'document'],
  ['/shared', 'document'],
  ['/review', 'document'],
];

// Paginas fora do PageLayout (login, registo...): so um formulario centrado.
const STANDALONE_PREFIXES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/set-password', '/auth'];

function variantFor(pathname: string): Variant {
  return VARIANT_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'cards';
}

function Body({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'dashboard':
      return (
        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-full" />
            <Skeleton className="h-9 w-24 rounded-full" />
            <Skeleton className="h-9 w-32 rounded-full" />
          </div>
          <CardGridSkeleton cards={6} />
          <TableSkeleton rows={4} columns={5} />
        </div>
      );
    case 'table':
      return <TableSkeleton rows={6} columns={4} />;
    case 'week':
      return (
        <div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>
      );
    case 'notebook':
      return (
        <div aria-hidden="true" className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_1fr]">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
          <DocumentSkeleton />
        </div>
      );
    case 'profile':
      return (
        <div aria-hidden="true" className="max-w-3xl space-y-6">
          <div className="space-y-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-24 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2.5">
                <Skeleton className="h-7 w-48 max-w-full" />
                <Skeleton className="h-4 w-60 max-w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          </div>
          <FormSkeleton />
        </div>
      );
    case 'document':
      return <DocumentSkeleton paragraphs={4} />;
    default:
      return <CardGridSkeleton cards={6} />;
  }
}

// Fallback do React.lazy de TODAS as rotas: o utilizador ve logo a barra, o
// rodape e a forma da pagina enquanto o codigo dela descarrega.
export default function RouteSkeleton() {
  const { pathname } = useLocation();
  const { t } = useI18n();

  if (STANDALONE_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return (
      <div role="status" aria-busy="true" className="mx-auto flex min-h-[60vh] max-w-md items-center px-4">
        <span className="sr-only">{t('common.loading')}</span>
        <FormSkeleton />
      </div>
    );
  }

  return (
    <PageLayout>
      <div role="status" aria-busy="true">
        <span className="sr-only">{t('common.loading')}</span>
        <PageHeaderSkeleton withAction />
        <Body variant={variantFor(pathname)} />
      </div>
    </PageLayout>
  );
}
