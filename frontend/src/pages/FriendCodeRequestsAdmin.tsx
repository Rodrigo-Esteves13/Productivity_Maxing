import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ErrorState from '../components/UI/ErrorState';
import EmptyState from '../components/UI/EmptyState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { decideFriendCodeRequest, getFriendCodeRequests, type FriendCodeRequestRow } from '../api/socialService';
import { useI18n } from '../i18n/useI18n';
import { adminUserPath } from '../lib/appLinks';

// Admin: pedidos de troca de codigo de amigo. Aprovar gera o codigo novo do
// utilizador (as amizades ficam); recusar deixa uma nota opcional visivel a ele.
export default function FriendCodeRequestsAdmin() {
  const { t } = useI18n();
  useDocumentTitle(t('friendCodes.title'));
  const [rows, setRows] = useState<FriendCodeRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await getFriendCodeRequests());
      setHasError(false);
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (row: FriendCodeRequestRow, approve: boolean) => {
    setBusyId(row.id);
    try {
      await decideFriendCodeRequest(row.id, approve, notes[row.id]?.trim());
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      await load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageLayout>
      <PageHeader title={t('friendCodes.title')} description={t('friendCodes.description')} />
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : hasError ? (
        <ErrorState message={t('friendCodes.error')} />
      ) : rows.length === 0 ? (
        <EmptyState message={t('friendCodes.empty')} />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <Link
                  to={adminUserPath(row.user.id)}
                  className="text-sm font-medium text-white hover:text-violet-300 hover:underline"
                >
                  {row.user.name ?? t('common.na')}
                </Link>
                <span className="break-all">{row.user.email}</span>
                <span className="ml-auto">{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              {/* Texto de utilizador: nunca como HTML. */}
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-neutral-100">{row.reason}</p>
              <input
                type="text"
                value={notes[row.id] ?? ''}
                maxLength={300}
                placeholder={t('friendCodes.notePlaceholder')}
                aria-label={t('friendCodes.notePlaceholder')}
                onChange={(e) => setNotes((prev) => ({ ...prev, [row.id]: e.target.value }))}
                className="mt-3 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-white placeholder:text-neutral-600 focus:border-violet-500 focus:outline-none"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, true)}
                  className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {t('friendCodes.approve')}
                </button>
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => void decide(row, false)}
                  className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                >
                  {t('friendCodes.reject')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PageLayout>
  );
}
