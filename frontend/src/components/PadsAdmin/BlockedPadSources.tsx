import { Link } from 'react-router-dom';
import Button from '../UI/Button';
import ErrorState from '../UI/ErrorState';
import Pagination from '../UI/Pagination';
import { useI18n } from '../../i18n/useI18n';
import { formatDateTime } from '../../lib/timeFormat';
import { adminUserPath } from '../../lib/appLinks';
import type { AdminBlockedPadSource } from '../../types/models';

// Primeiros caracteres do hash do IP (o hash inteiro fica no title).
const ANON_HASH_SHOWN = 8;

interface BlockedPadSourcesProps {
  sources: {
    data: { total: number; items: AdminBlockedPadSource[] } | null;
    hasError: boolean;
    reload: () => Promise<void>;
  };
  skip: number;
  pageSize: number;
  onSkipChange: (skip: number) => void;
  onUnblock: (ipHash: string) => void;
}

// Todas as origens bloqueadas. Sem nenhuma (ou ainda a carregar) nao ocupa
// espaco na pagina.
export default function BlockedPadSources({
  sources,
  skip,
  pageSize,
  onSkipChange,
  onUnblock,
}: BlockedPadSourcesProps) {
  const { t, lang } = useI18n();
  const { data, hasError, reload } = sources;
  if (hasError) {
    return <ErrorState message={t('f7admin.pads.blockedError')} onRetry={() => void reload()} />;
  }
  if (!data || data.total === 0) return null;

  return (
    <section className="mb-4 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
      <h2 className="mb-1 text-sm font-semibold text-white">
        {t('ux4adm2.pads.blockedTitle')} ({data.total})
      </h2>
      <p className="mb-2 text-xs text-neutral-500">{t('f7admin.pads.blockedHint')}</p>
      <ul className="space-y-2">
        {data.items.map((source) => (
          <li key={source.ipHash} className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-mono text-xs text-neutral-300" title={source.ipHash}>
                {t('pad.admin.anonymous', { hash: source.ipHash.slice(0, ANON_HASH_SHOWN) })}
              </span>
              <p className="text-xs text-neutral-500">
                {formatDateTime(source.createdAt, lang)} ·{' '}
                {t('f7admin.pads.padCount', { count: source.padCount })}
                {source.blockedBy && (
                  <>
                    {' · '}
                    <Link to={adminUserPath(source.blockedBy.id)} className="hover:underline">
                      {source.blockedBy.name ?? source.blockedBy.email}
                    </Link>
                  </>
                )}
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onUnblock(source.ipHash)}>
              {t('pad.admin.unblock')}
            </Button>
          </li>
        ))}
      </ul>
      {data.total > pageSize && (
        <Pagination
          total={data.total}
          skip={skip}
          pageSize={pageSize}
          onNextPage={() => onSkipChange(skip + pageSize)}
          onPrevPage={() => onSkipChange(Math.max(0, skip - pageSize))}
        />
      )}
    </section>
  );
}
