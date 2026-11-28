import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import EmptyState from '../components/UI/EmptyState';
import { useI18n } from '../i18n/useI18n';
import LinesSkeleton from '../components/UI/LinesSkeleton';
import ErrorState from '../components/UI/ErrorState';
import NotebookSubjectPicker from '../components/Notebook/NotebookSubjectPicker';
import NotebookSearchResults from '../components/Notebook/NotebookSearchResults';
import NotebookSharedPanel from '../components/Notebook/NotebookSharedPanel';
import NotebookSearchBar from '../components/Notebook/page/NotebookSearchBar';
import NotebookWorkspace from '../components/Notebook/page/NotebookWorkspace';
import { useNotebookPage } from '../hooks/useNotebookPage';

export default function Notebook() {
  const { t } = useI18n();
  const page = useNotebookPage();
  const { areas, areasLoading, areasError, reloadAreas, selectedAreaId, selectedArea, groupByPeriod } = page;
  const { searchInputRef, ...search } = page.search;

  return (
    <PageLayout>
      <PageHeader title={t('notebook.title')} description={t('notebook.description')} />

      <NotebookSharedPanel />

      <NotebookSearchBar
        inputRef={searchInputRef}
        query={search.searchQuery}
        isActive={search.isSearchActive}
        onChange={search.setSearchQuery}
      />

      {search.isSearchActive ? (
        <NotebookSearchResults
          results={search.searchResults}
          isLoading={search.isSearching}
          query={search.searchQuery}
          hasError={search.searchFailed}
          onRetry={search.retrySearch}
          onSelect={page.handleSelectSearchResult}
        />
      ) : (
        <>
          {areasLoading ? (
            <LinesSkeleton lines={5} />
          ) : areasError ? (
            <ErrorState message={areasError} onRetry={reloadAreas} />
          ) : areas.length === 0 ? (
            <p className="text-sm text-neutral-500">{t('notebook.subjects.none')}</p>
          ) : (
            <NotebookSubjectPicker
              areas={areas}
              selectedAreaId={selectedAreaId}
              groupByPeriod={groupByPeriod}
              onSelect={page.selectArea}
            />
          )}

          {!selectedArea ? (
            <div className="mt-6">
              <EmptyState message={t('notebook.pick')} />
            </div>
          ) : (
            <NotebookWorkspace area={selectedArea} page={page} />
          )}
        </>
      )}
    </PageLayout>
  );
}
