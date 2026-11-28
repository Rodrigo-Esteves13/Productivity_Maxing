import PageLayout from '../components/Layout/PageLayout';
import { BookOpenIcon } from '../components/UI/Icons';
import DocumentSkeleton from '../components/UI/DocumentSkeleton';
import SharedEntryNav from '../components/Notebook/shared/SharedEntryNav';
import ShareAccessGate from '../components/Notebook/shared/ShareAccessGate';
import SharedNotebookEntryView from '../components/Notebook/shared/SharedNotebookEntryView';
import { useSharedNotebookEntry } from '../hooks/useSharedNotebookEntry';
import { useI18n } from '../i18n/useI18n';

// Usa o mesmo PageLayout (header + footer) das restantes páginas, para quem
// abre um link partilhado - mesmo sem conta - ver a app inteira à volta e
// não um ecrã solto. É a única página pensada para alguém sem conta.
export default function SharedNotebookEntry() {
  const { t } = useI18n();
  const {
    token,
    entry,
    role,
    hasPendingProposal,
    context,
    gateStatus,
    isLoading,
    error,
    hasSession,
    isRequesting,
    reload,
    requestAccess,
    respondInvitation,
  } = useSharedNotebookEntry();

  if (isLoading) {
    return (
      <PageLayout>
        <DocumentSkeleton />
      </PageLayout>
    );
  }

  if (gateStatus) {
    return (
      <PageLayout>
        <ShareAccessGate
          status={gateStatus}
          token={token ?? ''}
          hasSession={hasSession}
          isRequesting={isRequesting}
          error={error}
          onRequestAccess={requestAccess}
          onInvitation={respondInvitation}
        />
      </PageLayout>
    );
  }

  if (error || !entry) {
    return (
      <PageLayout>
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-2 px-4 text-center">
          <BookOpenIcon className="h-8 w-8 text-neutral-700" />
          <p className="text-sm text-neutral-400">{error || t('ui.shareLinkInvalid')}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {hasSession && <SharedEntryNav title={entry.title} context={context} />}
      <SharedNotebookEntryView
        entry={entry}
        token={token ?? ''}
        role={role}
        hasPendingProposal={hasPendingProposal}
        onChanged={reload}
      />
    </PageLayout>
  );
}
