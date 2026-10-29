import { useState, type FormEvent } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAuth } from '../context/useAuth';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import EmptyState from '../components/UI/EmptyState';
import FormError from '../components/UI/FormError';
import TableSkeleton from '../components/UI/TableSkeleton';
import ApiKeysTable from '../components/Developer/ApiKeysTable';
import NewApiKeyModal from '../components/Developer/NewApiKeyModal';
import type { ApiKeyScope } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { useI18n } from '../i18n/useI18n';

export default function Developer() {
  const { t } = useI18n();
  const { confirm } = useFeedback();
  useDocumentTitle(t('ui.developer'));
  const { user } = useAuth();
  const {
    keys,
    isLoading,
    loadError,
    isCreating,
    createError,
    newlyCreatedKey,
    createKey,
    removeKey,
    clearNewKey,
  } = useApiKeys();
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiKeyScope>('TASKS');

  // Only shown to admins - a non-admin selecting it would be pointless
  // anyway, since the backend silently downgrades an ADMIN request from
  // anyone whose Role isn't already ADMIN (see AuthService.generateApiKey).
  // This is just UI convenience, not the actual security boundary.
  const isAdmin = user?.role === 'ADMIN';

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;
    if (!(await createKey(name.trim(), isAdmin ? scope : 'TASKS'))) return;
    setName('');
    setScope('TASKS');
  };

  const handleRevoke = async (id: string) => {
    // Revogar é imediato e irreversível (a raw key nunca mais existe em
    // lado nenhum) - vale a pena confirmar em vez de deixar um clique
    // acidental partir uma integração a meio.
    const confirmed = await confirm({
      title: t('ui.revokeApiKey'),
      message: t('ui.revokeThisApiKeyAny'),
      confirmLabel: t('social.notes.revoke'),
      tone: 'danger',
    });
    if (confirmed) removeKey(id);
  };

  return (
    <PageLayout>
      <PageHeader
        title={t('ui.developer')}
        description={t('ui.personalApiKeysToScript')}
      />

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('ui.keyNameEGLeague')}
          aria-label={t('ui.keyNameEGLeague')}
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-600"
        />
        {isAdmin && (
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApiKeyScope)}
            title={t('ui.tasksYourOwnTasksPeriods')}
            aria-label={t('ui.tasksYourOwnTasksPeriods')}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="TASKS">{t('ui.tasksScope')}</option>
            <option value="ADMIN">{t('ui.adminScope')}</option>
          </select>
        )}
        <ActionButton type="submit" disabled={!name.trim() || isCreating}>
          {isCreating ? t('ui.generating') : t('ui.generateNewKey')}
        </ActionButton>
      </form>
      {createError && (
        <div className="-mt-5 mb-8">
          <FormError message={t('ui.couldNotCreateApiKey')} />
        </div>
      )}

      {isLoading ? (
        <TableSkeleton rows={3} columns={4} />
      ) : loadError ? (
        <FormError message={t('ui.couldNotLoadApiKeys')} />
      ) : keys.length === 0 ? (
        <EmptyState message={t('ui.youDonTHaveAny')} />
      ) : (
        <ApiKeysTable keys={keys} onRevoke={handleRevoke} />
      )}

      {newlyCreatedKey && (
        <NewApiKeyModal apiKey={newlyCreatedKey} onClose={clearNewKey} />
      )}
    </PageLayout>
  );
}
