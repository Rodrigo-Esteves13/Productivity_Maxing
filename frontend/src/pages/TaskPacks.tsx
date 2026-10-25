import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Breadcrumbs from '../components/UI/Breadcrumbs';
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
import { useI18n } from '../i18n/useI18n';

export default function TaskPacks() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.taskPacks'));
  const { packs, tasks, areas, isLoading, hasError, isSaving, create, remove, publish } = useTaskPacks();
  const packUpdates = usePackUpdates();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <PageLayout>
      <Breadcrumbs items={[{ label: t('nav.tasks'), to: '/tasks' }, { label: t('nav.taskPacks') }]} />
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
        <TaskPackList packs={packs} onDelete={remove} onPublish={publish} />
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
