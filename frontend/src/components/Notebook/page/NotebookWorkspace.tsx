import ErrorState from '../../UI/ErrorState';
import LinesSkeleton from '../../UI/LinesSkeleton';
import NotebookAreaOverview from '../NotebookAreaOverview';
import NotebookEntryList from '../NotebookEntryList';
import NotebookAreaHeader from './NotebookAreaHeader';
import NotebookEntryNav from './NotebookEntryNav';
import NotebookEntryPane from './NotebookEntryPane';
import type { NotebookPageState } from '../../../hooks/useNotebookPage';
import type { Area } from '../../../types/models';

// O caderno de uma cadeira: cabecalho, lista de notas e nota aberta.
export default function NotebookWorkspace({ area, page }: { area: Area; page: NotebookPageState }) {
  const {
    entries,
    isLoading: entriesLoading,
    error: entriesError,
    reloadList,
    selectedId,
    selectedIndex,
    olderEntry,
    newerEntry,
    selectEntry,
    prefetchEntry,
    shareByEntry,
    openFromList,
    isCreating,
    handleNewEntry,
    editorRef,
  } = page;

  return (
    <div className="mt-6 space-y-5">
      <NotebookAreaHeader area={area} page={page} />

      {entriesError && !entriesLoading ? (
        <ErrorState message={entriesError} onRetry={reloadList} />
      ) : !entriesLoading && entries.length === 0 ? (
        // Caderno vazio: um so convite a comecar, sem lista vazia ao lado.
        <NotebookAreaOverview
          entries={entries}
          isCreating={isCreating}
          onSelect={selectEntry}
          onNewEntry={() => void handleNewEntry()}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[16rem_minmax(0,1fr)] lg:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="md:sticky md:top-20 md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto md:pr-1">
            {entriesLoading ? (
              <LinesSkeleton lines={4} />
            ) : (
              <NotebookEntryList
                entries={entries}
                shareByEntry={shareByEntry}
                selectedId={selectedId}
                onPrefetch={prefetchEntry}
                onSelect={openFromList}
              />
            )}
          </div>

          <div ref={editorRef} className="min-w-0 scroll-mt-20">
            {selectedId && (
              <NotebookEntryNav
                selectedIndex={selectedIndex}
                total={entries.length}
                olderEntry={olderEntry}
                newerEntry={newerEntry}
                onSelect={selectEntry}
                onPrefetch={prefetchEntry}
              />
            )}
            <NotebookEntryPane page={page} />
          </div>
        </div>
      )}
    </div>
  );
}
