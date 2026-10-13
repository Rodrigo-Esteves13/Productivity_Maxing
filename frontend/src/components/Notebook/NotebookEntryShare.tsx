import type { UseEntryShareResult } from '../../hooks/useEntryShare';
import type { NotebookShareVisibility } from '../../types/models';
import { LinkIcon, CheckIcon, XIcon } from '../UI/Icons';
import CopyButton from '../UI/CopyButton';
import IconButton from '../UI/IconButton';
import SegmentedControl from '../UI/SegmentedControl';
import type { SegmentedOption } from '../UI/SegmentedControl';

interface NotebookEntryShareProps {
  share: UseEntryShareResult;
}

const VISIBILITY_OPTIONS: SegmentedOption<NotebookShareVisibility>[] = [
  { value: 'PUBLIC', label: 'Public link' },
  { value: 'AUTHORIZED', label: 'Authorized only' },
];

// Apresentacional: o estado vive em useEntryShare (chamado no wrapper do
// editor) para o painel sobreviver ao "Cancel"/gravar da edicao. Partilhar
// nao depende de estar em modo edicao nem de gravar nada, e uma acao a parte
// sobre a entrada ja guardada.
export default function NotebookEntryShare({ share }: NotebookEntryShareProps) {
  const {
    isOpen, token, visibility, isLoading, error, shareUrl, requests, pendingCount,
    isRequestsLoading, decidingId, open, close, create, revoke, changeVisibility, decide,
  } = share;

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => void open()}
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
        <IconButton label="Close" className="p-1 hover:bg-neutral-800" onClick={close}>
          <XIcon className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {token && (
        <SegmentedControl
          className={`mt-2 w-full [&>button]:flex-1 [&>button]:justify-center ${isLoading ? 'pointer-events-none opacity-60' : ''}`}
          size="sm"
          surface="sunken"
          options={VISIBILITY_OPTIONS}
          value={visibility}
          onChange={(next) => void changeVisibility(next)}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {token ? (
          <>
            <input
              readOnly
              value={shareUrl}
              aria-label="Share link"
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 focus:border-violet-500 focus:outline-none"
            />
            <CopyButton text={shareUrl} className="px-2.5 py-1.5" />
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void revoke()}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-neutral-800 disabled:opacity-50"
            >
              Stop sharing
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void create()}
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
                      onClick={() => void decide(req.id, 'APPROVED')}
                      aria-label="Approve"
                      className="rounded-md bg-emerald-500/15 p-1 text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                      <CheckIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={decidingId === req.id}
                      onClick={() => void decide(req.id, 'DENIED')}
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
