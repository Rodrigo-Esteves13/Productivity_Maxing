import { useEffect, useState } from 'react';
import {
  getShareStatus,
  createShare,
  revokeShare,
  updateShareVisibility,
  getShareAccessRequests,
  decideShareAccessRequest,
} from '../../api/notebookService';
import type { NotebookShareVisibility, ShareAccessRequest } from '../../types/models';
import { LinkIcon, CopyIcon, CheckIcon, XIcon } from '../UI/Icons';

interface NotebookEntryShareProps {
  entryId: string;
}

// Autónomo de propósito (estado próprio, não passa pelo form de
// draft/save do NotebookEntryEditor) - partilhar não depende de estar em
// modo edição nem de gravar nada, é uma ação à parte sobre a entrada já
// guardada.
export default function NotebookEntryShare({ entryId }: NotebookEntryShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<NotebookShareVisibility>('PUBLIC');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [requests, setRequests] = useState<ShareAccessRequest[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  useEffect(() => {
    // Repõe tudo ao trocar de entrada - o token de uma não pode "vazar"
    // para o painel de outra enquanto o estado carrega.
    setIsOpen(false);
    setToken(null);
    setVisibility('PUBLIC');
    setError('');
    setCopied(false);
    setRequests([]);
  }, [entryId]);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : '';
  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const loadRequests = async () => {
    setIsRequestsLoading(true);
    try {
      setRequests(await getShareAccessRequests(entryId));
    } catch {
      // Painel secundário - um erro aqui não deve esconder o link em si.
    } finally {
      setIsRequestsLoading(false);
    }
  };

  const openPanel = async () => {
    setIsOpen(true);
    setIsLoading(true);
    setError('');
    try {
      const status = await getShareStatus(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
      if (status.token && status.visibility === 'AUTHORIZED') await loadRequests();
    } catch {
      setError('Could not check the share status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    setIsLoading(true);
    setError('');
    try {
      const status = await createShare(entryId);
      setToken(status.token);
      setVisibility(status.visibility);
    } catch {
      setError('Could not create the share link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    setIsLoading(true);
    setError('');
    try {
      await revokeShare(entryId);
      setToken(null);
      setRequests([]);
    } catch {
      setError('Could not stop sharing.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVisibilityChange = async (next: NotebookShareVisibility) => {
    if (next === visibility) return;
    setIsLoading(true);
    setError('');
    try {
      const status = await updateShareVisibility(entryId, next);
      setVisibility(status.visibility);
      if (status.visibility === 'AUTHORIZED') await loadRequests();
    } catch {
      setError('Could not change who can access this link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecide = async (requestId: string, decision: 'APPROVED' | 'DENIED') => {
    setDecidingId(requestId);
    try {
      const updated = await decideShareAccessRequest(entryId, requestId, decision);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, status: updated.status } : r)));
    } catch {
      setError('Could not update that request. Please try again.');
    } finally {
      setDecidingId(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy - select and copy the link manually.');
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={openPanel}
        className="flex items-center gap-1 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
      >
        <LinkIcon className="h-3.5 w-3.5" />
        Share
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-neutral-800 bg-neutral-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-300">
          {token
            ? visibility === 'PUBLIC'
              ? 'Anyone with this link can view this lesson (read-only).'
              : 'Only people you approve can view this lesson - they need to log in and request access first.'
            : 'Share a read-only link to this lesson.'}
        </p>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Close"
          className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {token && (
        <div className="mt-2 flex gap-1 rounded-md bg-neutral-950 p-0.5 text-xs">
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleVisibilityChange('PUBLIC')}
            className={`flex-1 rounded px-2 py-1 font-medium disabled:opacity-50 ${
              visibility === 'PUBLIC'
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Public link
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => handleVisibilityChange('AUTHORIZED')}
            className={`flex-1 rounded px-2 py-1 font-medium disabled:opacity-50 ${
              visibility === 'AUTHORIZED'
                ? 'bg-neutral-800 text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            Authorized only
          </button>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {token ? (
          <>
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 focus:border-violet-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={handleRevoke}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-neutral-800 disabled:opacity-50"
            >
              Stop sharing
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={handleShare}
            className="flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {isLoading ? 'Loading...' : 'Create share link'}
          </button>
        )}
      </div>

      {token && visibility === 'AUTHORIZED' && (
        <div className="mt-3 border-t border-neutral-800 pt-2">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-neutral-500">
            Access requests
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-amber-400">
                {pendingCount} pending
              </span>
            )}
          </p>
          {isRequestsLoading && <p className="text-xs text-neutral-500">Loading...</p>}
          {!isRequestsLoading && requests.length === 0 && (
            <p className="text-xs text-neutral-600">Nobody has requested access yet.</p>
          )}
          <ul className="space-y-1.5">
            {requests.map((req) => (
              <li key={req.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <p className="truncate text-neutral-200">{req.requestingUser.name ?? req.requestingUser.email}</p>
                  <p className="truncate text-neutral-500">{req.requestingUser.email}</p>
                </div>
                {req.status === 'PENDING' ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => handleDecide(req.id, 'APPROVED')}
                      aria-label="Approve"
                      className="rounded-md bg-emerald-500/15 p-1 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => handleDecide(req.id, 'DENIED')}
                      aria-label="Deny"
                      className="rounded-md bg-red-500/15 p-1 text-red-400 hover:bg-red-500/25 disabled:opacity-50"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <span
                    className={`flex shrink-0 items-center gap-1 text-[11px] ${
                      req.status === 'APPROVED' ? 'text-emerald-400' : 'text-neutral-500'
                    }`}
                  >
                    {req.status === 'APPROVED' ? <CheckIcon className="h-3 w-3" /> : <XIcon className="h-3 w-3" />}
                    {req.status === 'APPROVED' ? 'Approved' : 'Denied'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
