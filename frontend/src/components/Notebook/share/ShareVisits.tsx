import { useI18n } from '../../../i18n/useI18n';
import type { UseEntryShareResult } from '../../../hooks/useEntryShare';

// Quem abriu o link.
export default function ShareVisits({ share }: { share: UseEntryShareResult }) {
  const { t, lang } = useI18n();
  const { visits, visitsError } = share;

  return (
    <div className="mt-3 border-t border-neutral-800 pt-2">
      <p className="mb-1 text-xs font-medium text-neutral-300">{t('share.visits.title')}</p>
      {visitsError && <p className="text-xs text-red-400">{t('share.visits.error')}</p>}
      {!visitsError && visits && visits.viewers.length === 0 && (
        <p className="text-xs text-neutral-500">{t('share.visits.empty')}</p>
      )}
      {visits && visits.viewers.length > 0 && (
        <>
          <p className="mb-1.5 text-xs text-neutral-400">
            {t('share.visits.summary', { total: visits.totalVisits, people: visits.uniqueVisitors })}
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto">
            {visits.viewers.map((viewer, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate text-neutral-200" title={viewer.name ?? undefined}>
                  {viewer.name ?? t('share.visits.anonymous')}
                </span>
                <span className="shrink-0 text-neutral-500">
                  {t('share.visits.row', {
                    count: viewer.count,
                    when: new Date(viewer.lastVisitAt).toLocaleDateString(lang, {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-1.5 text-[11px] text-neutral-500">{t('share.visits.hint')}</p>
    </div>
  );
}
