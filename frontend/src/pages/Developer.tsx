import { useState, type FormEvent } from 'react';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useApiKeys } from '../hooks/useApiKeys';
import { useAuth } from '../context/useAuth';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import LoadingState from '../components/UI/LoadingState';
import EmptyState from '../components/UI/EmptyState';
import ApiKeysTable from '../components/Developer/ApiKeysTable';
import NewApiKeyModal from '../components/Developer/NewApiKeyModal';
import type { ApiKeyScope } from '../types/models';

export default function Developer() {
  useDocumentTitle('Developer');
  const { user } = useAuth();
  const { keys, isLoading, isCreating, newlyCreatedKey, createKey, removeKey, clearNewKey } =
    useApiKeys();
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
    await createKey(name.trim(), isAdmin ? scope : 'TASKS');
    setName('');
    setScope('TASKS');
  };

  const handleRevoke = (id: string) => {
    // Revogar é imediato e irreversível (a raw key nunca mais existe em
    // lado nenhum) - vale a pena um confirm nativo em vez de deixar um
    // clique acidental partir uma integração a meio.
    if (window.confirm('Revoke this API key? Any script using it will stop working immediately.')) {
      removeKey(id);
    }
  };

  return (
    <PageLayout>
      <PageHeader
        title="Developer"
        description="Personal API keys to script against your own Productivity Maxing data. Send yours as the x-api-key header."
      />

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. 'League bot script')"
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-600"
        />
        {isAdmin && (
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ApiKeyScope)}
            title="TASKS: your own tasks/periods/programs only. ADMIN: also the global Areas/TaskTypes catalog."
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-violet-600"
          >
            <option value="TASKS">TASKS scope</option>
            <option value="ADMIN">ADMIN scope</option>
          </select>
        )}
        <ActionButton type="submit" disabled={!name.trim() || isCreating}>
          {isCreating ? 'Generating...' : 'Generate new key'}
        </ActionButton>
      </form>

      {isLoading ? (
        <LoadingState message="Loading API keys..." />
      ) : keys.length === 0 ? (
        <EmptyState message="You don't have any API keys yet. Generate one above to get started." />
      ) : (
        <ApiKeysTable keys={keys} onRevoke={handleRevoke} />
      )}

      {newlyCreatedKey && (
        <NewApiKeyModal apiKey={newlyCreatedKey} onClose={clearNewKey} />
      )}
    </PageLayout>
  );
}
