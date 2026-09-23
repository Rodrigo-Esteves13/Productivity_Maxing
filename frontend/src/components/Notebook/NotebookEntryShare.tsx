import { useEffect, useState } from 'react';
import { getShareStatus, createShare, revokeShare } from '../../api/notebookService';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Repõe tudo ao trocar de entrada - o token de uma não pode "vazar"
    // para o painel de outra enquanto o estado carrega.
    setIsOpen(false);
    setToken(null);
    setError('');
    setCopied(false);
  }, [entryId]);

  const shareUrl = token ? `${window.location.origin}/shared/${token}` : '';

  const openPanel = async () => {
    setIsOpen(true);
    setIsLoading(true);
    setError('');
    try {
      const status = await getShareStatus(entryId);
      setToken(status.token);
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
    } catch {
      setError('Could not stop sharing.');
    } finally {
      setIsLoading(false);
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
          {token ? 'Anyone with this link can view this lesson (read-only).' : 'Share a read-only link to this lesson.'}
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
    </div>
  );
}
