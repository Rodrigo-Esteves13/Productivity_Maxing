import { useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import LoadingState from '../components/UI/LoadingState';
import TaskPackList from '../components/TaskPacks/TaskPackList';
import CreateTaskPackModal from '../components/TaskPacks/CreateTaskPackModal';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTaskPacks } from '../hooks/useTaskPacks';
import { useI18n } from '../i18n/useI18n';

export default function TaskPacks() {
  const { t } = useI18n();
  useDocumentTitle(t('nav.taskPacks'));
  const { packs, tasks, areas, isLoading, hasError, isSaving, create, remove } = useTaskPacks();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <PageLayout>
      <PageHeader
        title={t('nav.taskPacks')}
        description={t('packs.description')}
        action={<ActionButton onClick={() => setIsCreating(true)}>{t('packs.new')}</ActionButton>}
      />
      {isLoading ? (
        <LoadingState message={t('common.loading')} />
      ) : hasError ? (
        <ErrorState message={t('packs.loadError')} />
      ) : packs.length === 0 ? (
        <EmptyState message={t('packs.empty')} />
      ) : (
        <TaskPackList packs={packs} onDelete={remove} />
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
