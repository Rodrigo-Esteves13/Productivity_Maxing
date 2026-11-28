import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import { friendNotesPath, friendPath, socialTabPath } from '../lib/appLinks';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TableSkeleton from '../components/UI/TableSkeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getFriendNotes, type FriendNotesList } from '../api/socialNotesService';
import SearchField from '../components/UI/SearchField';
import Select from '../components/UI/Select';
import { areaColorOf } from '../components/SharedWithMe/sharedWithMeLabels';
import { useListSearch } from '../hooks/useListSearch';
import { useI18n } from '../i18n/useI18n';
import {
  ALL_AREAS,
  filterNotesByArea,
  noteAreas,
  sortFriendNotes,
  type FriendNoteSort,
} from '../lib/socialLists';

const NOTE_SORTS: FriendNoteSort[] = ['newest', 'oldest', 'title'];
const NOTE_SORT_LABEL: Record<FriendNoteSort, string> = {
  newest: 'ux4social.sort.newest',
  oldest: 'ux4social.sort.oldest',
  title: 'ux4social.sort.title',
};

export default function FriendNotes() {
  const { t, lang } = useI18n();
  const { ownerId } = useParams<{ ownerId: string }>();
  const [data, setData] = useState<FriendNotesList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  useDocumentTitle(t('social.notes.pageTitle'));

  const load = useCallback(() => {
    if (!ownerId) return () => {};
    let cancelled = false;
    setIsLoading(true);
    setHasError(false);
    getFriendNotes(ownerId)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setHasError(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ownerId]);

  useEffect(() => load(), [load]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  const areas = useMemo(() => noteAreas(entries), [entries]);
  const [areaId, setAreaId] = useState(ALL_AREAS);
  const [sort, setSort] = useState<FriendNoteSort>('newest');
  const inArea = useMemo(() => filterNotesByArea(entries, areaId), [entries, areaId]);
  const search = useListSearch(inArea, (e) => [e.title, e.areaName]);
  const visible = useMemo(() => sortFriendNotes(search.filtered, sort), [search.filtered, sort]);
  const isFiltered = search.isFiltering || areaId !== ALL_AREAS;

  return (
    <PageLayout>
      <Breadcrumbs
        items={[
          { label: t('nav.social'), to: socialTabPath('friends') },
          { label: data?.ownerName ?? t('social.anonymous'), to: ownerId ? friendPath(ownerId) : undefined },
          { label: t('social.notes.crumb') },
        ]}
      />
      <PageHeader
        title={t('social.notes.pageTitleOf', { name: data?.ownerName ?? t('social.anonymous') })}
        description={t('social.notes.readOnlyHint')}
      />
      {isLoading ? (
        <TableSkeleton rows={5} columns={3} />
      ) : hasError || !data ? (
        <ErrorState message={t('social.notes.noAccess')} onRetry={load} />
      ) : data.entries.length === 0 ? (
        <EmptyState message={t('social.notes.noEntries')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField value={search.query} onChange={search.setQuery} label={t('ux4social.notes.search')} />
            {areas.length > 1 && (
              <Select
                aria-label={t('ux4social.notes.areaFilter')}
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="py-2 pointer-coarse:min-h-11"
              >
                <option value={ALL_AREAS}>{t('ux4social.notes.allAreas')}</option>
                {areas.map((a) => (
                  <option key={a.areaId} value={a.areaId}>
                    {a.areaName}
                  </option>
                ))}
              </Select>
            )}
            <Select
              aria-label={t('ux4social.notes.sortLabel')}
              value={sort}
              onChange={(e) => setSort(e.target.value as FriendNoteSort)}
              className="py-2 pointer-coarse:min-h-11"
            >
              {NOTE_SORTS.map((value) => (
                <option key={value} value={value}>
                  {t(NOTE_SORT_LABEL[value])}
                </option>
              ))}
            </Select>
            {isFiltered && (
              <span className="text-xs text-neutral-500">
                {t('search.count', { shown: visible.length, total: entries.length })}
              </span>
            )}
          </div>
          {visible.length === 0 ? (
            <EmptyState
              message={
                search.isFiltering
                  ? t('search.noResultsFor', { query: search.query.trim() })
                  : t('search.noResults')
              }
            />
          ) : (
        <ul className="space-y-2">
          {visible.map((e) => (
            <li key={e.id}>
              <Link
                to={`${friendNotesPath(ownerId ?? '')}/${encodeURIComponent(e.id)}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 hover:border-neutral-700"
              >
                <span className="min-w-0 truncate text-sm font-medium text-white" title={e.title}>
                  {e.entryType === 'CLASS' && e.classNumber !== null ? `#${e.classNumber} · ` : ''}
                  {e.title}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: areaColorOf(e.areaColor) }}
                  />
                  {e.areaName} · {new Date(e.date).toLocaleDateString(lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
          )}
        </>
      )}
    </PageLayout>
  );
}
