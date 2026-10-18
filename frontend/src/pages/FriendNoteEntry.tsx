import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import DocumentSkeleton from '../components/UI/DocumentSkeleton';
import ErrorState from '../components/UI/ErrorState';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { getFriendNoteEntry } from '../api/socialNotesService';
import type { SharedNotebookEntry as SharedNotebookEntryData } from '../types/models';
import { SharedNotebookEntryView } from './SharedNotebookEntry';
import { useI18n } from '../i18n/useI18n';

/** Leitura (so leitura) de uma nota de um amigo; reutiliza a vista das partilhas. */
export default function FriendNoteEntry() {
  const { t } = useI18n();
  const { ownerId, entryId } = useParams<{ ownerId: string; entryId: string }>();
  const [entry, setEntry] = useState<SharedNotebookEntryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  useDocumentTitle(entry?.title ?? t('social.notes.pageTitle'));

  useEffect(() => {
    if (!ownerId || !entryId) return;
    let cancelled = false;
    getFriendNoteEntry(ownerId, entryId)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 'ok') setEntry(res.entry);
        else setHasError(true);
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
  }, [ownerId, entryId]);

  return (
    <PageLayout>
      <div className="mx-auto mb-3 max-w-3xl">
        <Link to={`/social/notes/${ownerId ?? ''}`} className="text-sm text-violet-400 hover:text-violet-300">
          {t('social.notes.back')}
        </Link>
      </div>
      {isLoading ? (
        <DocumentSkeleton />
      ) : hasError || !entry ? (
        <ErrorState message={t('social.notes.noAccess')} />
      ) : (
        <SharedNotebookEntryView
          entry={entry}
          token=""
          role="VIEWER"
          hasPendingProposal={false}
          onChanged={() => undefined}
        />
      )}
    </PageLayout>
  );
}
