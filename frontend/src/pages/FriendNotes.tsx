import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import LoadingState from '../components/UI/LoadingState';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getFriendNotes, type FriendNotesList } from '../api/socialNotesService';
import { useI18n } from '../i18n/useI18n';

export default function FriendNotes() {
  const { t, lang } = useI18n();
  const { ownerId } = useParams<{ ownerId: string }>();
  const [data, setData] = useState<FriendNotesList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  useDocumentTitle(t('social.notes.pageTitle'));

  useEffect(() => {
    if (!ownerId) return;
    let cancelled = false;
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

  return (
    <PageLayout>
      <PageHeader
        title={t('social.notes.pageTitleOf', { name: data?.ownerName ?? t('social.anonymous') })}
        description={t('social.notes.readOnlyHint')}
      />
      {isLoading ? (
        <LoadingState message={t('common.loading')} />
      ) : hasError || !data ? (
        <ErrorState message={t('social.notes.noAccess')} />
      ) : data.entries.length === 0 ? (
        <EmptyState message={t('social.notes.noEntries')} />
      ) : (
        <ul className="space-y-2">
          {data.entries.map((e) => (
            <li key={e.id}>
              <Link
                to={`/social/notes/${ownerId}/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 hover:border-neutral-700"
              >
                <span className="min-w-0 truncate text-sm font-medium text-white">
                  {e.entryType === 'CLASS' && e.classNumber !== null ? `#${e.classNumber} · ` : ''}
                  {e.title}
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-neutral-500">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: e.areaColor ?? '#808080' }}
                  />
                  {e.areaName} · {new Date(e.date).toLocaleDateString(lang)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
