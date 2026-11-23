import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import TableSkeleton from '../components/UI/TableSkeleton';
import TaskPackList from '../components/TaskPacks/TaskPackList';
import PackUpdatesList from '../components/TaskPacks/PackUpdatesList';
import SectionLabel from '../components/UI/SectionLabel';
import { usePackUpdates } from '../hooks/usePackUpdates';
import CreateTaskPackModal from '../components/TaskPacks/CreateTaskPackModal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTaskPacks } from '../hooks/useTaskPacks';
import { useListSearch } from '../hooks/useListSearch';
import SearchField from '../components/UI/SearchField';
import { useI18n } from '../i18n/useI18n';

// Abaixo disto a pesquisa so atrapalha.
const PACK_SEARCH_MIN = 5;

export default function TaskPacks() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.taskPacks'));
  const { packs, tasks, areas, isLoading, hasError, isSaving, create, remove, rename, publish } = useTaskPacks();
  const search = useListSearch(packs, (p) => [p.name]);
  const packUpdates = usePackUpdates();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <PageLayout>
      <PageHeader
        title={t('nav.taskPacks')}
        description={t('packs.description')}
        action={<ActionButton onClick={() => setIsCreating(true)}>{t('packs.new')}</ActionButton>}
      />
      {/* Pedidos de quem partilhou pacotes contigo: so aparece quando ha. */}
      {packUpdates.updates.length > 0 && (
        <section id="updates" className="mb-8">
          <SectionLabel className="block mb-2">{t('packs.updates.title', { count: packUpdates.updates.length })}</SectionLabel>
          <p className="mb-3 text-sm text-neutral-400">{t('packs.updates.intro')}</p>
          <PackUpdatesList
            updates={packUpdates.updates}
            busyId={packUpdates.busyId}
            onAccept={packUpdates.accept}
            onReject={packUpdates.reject}
          />
        </section>
      )}
      {packUpdates.hasError && <ErrorState message={t('packs.updates.loadError')} />}
      {isLoading ? (
        <TableSkeleton rows={4} columns={3} />
      ) : hasError ? (
        <ErrorState message={t('packs.loadError')} />
      ) : packs.length === 0 ? (
        <EmptyState message={t('packs.empty')} />
      ) : (
        <>
          {packs.length >= PACK_SEARCH_MIN && (
            <SearchField className="mb-4" value={search.query} onChange={search.setQuery} label={t('ux4packs.list.search')} />
          )}
          {search.filtered.length === 0 ? (
            <EmptyState message={t('search.noResultsFor', { query: search.query.trim() })} />
          ) : (
            <TaskPackList packs={search.filtered} onDelete={remove} onRename={rename} onPublish={publish} />
          )}
        </>
      )}
      <CreateTaskPackModal
        isOpen={isCreating}
        tasks={tasks}
        areas={areas}
        isSaving={isSaving}
        onClose={() => setIsCreating(false)}
        onCreate={create}
      />
    </PageLayout>
  );
}
