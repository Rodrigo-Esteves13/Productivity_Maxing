import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getSharedNotebookEntry, requestShareAccess } from '../api/notebookService';
import { fetchCsrfToken } from '../api/userService';
import { setCsrfToken } from '../api/csrfStore';
import type { SharedNotebookEntry as SharedNotebookEntryData } from '../types/models';
import { useDrawingCanvas } from '../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../hooks/useCanvasShapes';
import { useCanvasLinks } from '../hooks/useCanvasLinks';
import { useCanvasTexts } from '../hooks/useCanvasTexts';
import NotebookCanvas from '../components/Notebook/NotebookCanvas';
import NotebookTableEditor from '../components/Notebook/NotebookTableEditor';
import { LinkIcon, FileIcon, BookOpenIcon, ShieldIcon } from '../components/UI/Icons';
import LoadingState from '../components/UI/LoadingState';
import useDocumentTitle from '../hooks/useDocumentTitle';

const noop = () => {};

// Sem AuthContext, sem Navbar, sem Notebook.tsx à volta - de propósito, é
// a única página desta app pensada para alguém sem conta nenhuma.
type ShareGateStatus = 'login_required' | 'not_requested' | 'pending' | 'denied';

export default function SharedNotebookEntry() {
  const { token } = useParams<{ token: string }>();
  const [entry, setEntry] = useState<SharedNotebookEntryData | null>(null);
  const [gateStatus, setGateStatus] = useState<ShareGateStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  // Whether a CSRF token was successfully picked up for the current
  // visitor - i.e. they DO have a valid session. Determines whether the
  // "Request access" button can call requestShareAccess() directly, or
  // needs to send the visitor to log in first. Loaded eagerly (not only
  // when gateStatus turns out to need it) so the button is never
  // momentarily disabled right when someone would use it.
  const [hasSession, setHasSession] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  const load = () => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    getSharedNotebookEntry(token)
      .then((result) => {
        if (result.status === 'ok') {
          setEntry(result.entry);
          setGateStatus(null);
        } else {
          setEntry(null);
          setGateStatus(result.status);
        }
      })
      .catch(() => setError('This share link is invalid or was removed.'))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [token]);

  useEffect(() => {
    // This page has no AuthProvider around it (see comment below) so
    // nothing else ever populates the in-memory CSRF token here. Fetched
    // silently on mount: failing just means the visitor is anonymous,
    // which the 'login_required' gate status already covers - it's not
    // an error worth surfacing on its own.
    fetchCsrfToken()
      .then((csrfToken) => {
        setCsrfToken(csrfToken);
        setHasSession(true);
      })
      .catch(() => setHasSession(false));
  }, []);

  useDocumentTitle(entry ? `${entry.title} (shared)` : 'Shared lesson');

  const handleRequestAccess = async () => {
    if (!token) return;
    setIsRequesting(true);
    setError('');
    try {
      await requestShareAccess(token);
      load();
    } catch {
      setError('Could not send the request. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading shared lesson..." className="min-h-screen" />;
  }

  if (gateStatus) {
    return (
      <ShareAccessGate
        status={gateStatus}
        token={token ?? ''}
        hasSession={hasSession}
        isRequesting={isRequesting}
        error={error}
        onRequestAccess={handleRequestAccess}
      />
    );
  }

  if (error || !entry) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-neutral-950 px-4 text-center">
        <BookOpenIcon className="h-8 w-8 text-neutral-700" />
        <p className="text-sm text-neutral-400">{error || 'This share link is invalid or was removed.'}</p>
      </div>
    );
  }

  return <SharedNotebookEntryView entry={entry} />;
}

// One screen for all 4 non-'ok' outcomes of an AUTHORIZED share - the
// wording and the single available action are the only things that
// change between them. redirect is built from the CURRENT path (not
// hardcoded to /shared/:token) so this keeps working if the route ever
// changes shape.
function ShareAccessGate({
  status,
  token,
  hasSession,
  isRequesting,
  error,
  onRequestAccess,
}: {
  status: ShareGateStatus;
  token: string;
  hasSession: boolean;
  isRequesting: boolean;
  error: string;
  onRequestAccess: () => void;
}) {
  const redirectPath = `/shared/${token}`;

  const copy: Record<ShareGateStatus, { title: string; body: string }> = {
    login_required: {
      title: 'Log in to view this lesson',
      body: 'The owner only allows people they approve to see this. Log in, then request access.',
    },
    not_requested: {
      title: 'Access required',
      body: "This lesson is only visible to people the owner approves. You're logged in - request access and they'll be notified.",
    },
    pending: {
      title: 'Request sent',
      body: "Your request is waiting for the owner's approval. Check back later.",
    },
    denied: {
      title: 'Request denied',
      body: 'The owner did not approve your request. You can ask again if you think this was a mistake.',
    },
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-950 px-4 text-center">
      <ShieldIcon className="h-8 w-8 text-neutral-700" />
      <h1 className="text-base font-semibold text-white">{copy[status].title}</h1>
      <p className="max-w-sm text-sm text-neutral-400">{copy[status].body}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {status === 'login_required' && (
        <a
          href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          Log in
        </a>
      )}

      {(status === 'not_requested' || status === 'denied') && hasSession && (
        <button
          type="button"
          disabled={isRequesting}
          onClick={onRequestAccess}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isRequesting ? 'Sending...' : status === 'denied' ? 'Request again' : 'Request access'}
        </button>
      )}
    </div>
  );
}

// À parte de propósito: useDrawingCanvas/useCanvasShapes/useCanvasLinks/
// useCanvasTexts só aplicam o valor inicial no primeiro render (são
// useState por baixo, ver comentário "trocar de entrada" em
// NotebookEntryEditor.tsx) - se estes hooks corressem no componente de
// cima, chamados sempre com `entry?.x ?? []` enquanto `entry` ainda era
// null, o canvas ficava preso a vazio mesmo depois dos dados chegarem.
// Este componente só monta quando `entry` já existe, por isso o valor
// inicial que os hooks veem já é o correto.
function SharedNotebookEntryView({ entry }: { entry: SharedNotebookEntryData }) {
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);
  const shapeLayer = useCanvasShapes(entry.canvasShapes ?? []);
  const linkLayer = useCanvasLinks(entry.canvasLinks ?? []);
  const textLayer = useCanvasTexts(entry.canvasTexts ?? []);

  const hasCanvas =
    (entry.drawingStrokes?.length ?? 0) > 0 ||
    (entry.canvasShapes?.length ?? 0) > 0 ||
    (entry.canvasTexts?.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border border-violet-900/50 bg-violet-950/30 px-3 py-1.5 text-center text-xs text-violet-300">
          Shared read-only view - Productivity Maxing
        </div>

        <div className="space-y-1">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: `${entry.area.colorHex}22`, color: entry.area.colorHex }}
          >
            {entry.area.name}
          </span>
          <h1 className="text-xl font-semibold text-white">{entry.title}</h1>
          <p className="text-xs text-neutral-500">{new Date(entry.date).toLocaleDateString()}</p>
        </div>

        {entry.textContent && (
          <div className="whitespace-pre-wrap break-words rounded-lg border border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-200">
            {entry.textContent}
          </div>
        )}

        {(entry.tables?.length ?? 0) > 0 && (
          <div className="space-y-3">
            {entry.tables!.map((table) => (
              <NotebookTableEditor key={table.id} table={table} readOnly onChange={noop} onDelete={noop} />
            ))}
          </div>
        )}

        {hasCanvas && (
          <NotebookCanvas
            canvas={canvas}
            shapes={shapeLayer}
            links={linkLayer}
            texts={textLayer}
            readOnly
            canvasHeight={entry.canvasHeight ?? undefined}
          />
        )}

        {(entry.usefulLinks?.length ?? 0) > 0 && (
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-neutral-500">
              Useful Links
            </span>
            <div className="space-y-1.5">
              {entry.usefulLinks!.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-violet-400 hover:border-violet-700"
                >
                  <LinkIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {entry.photos.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entry.photos.map(
              (photo) =>
                photo.url && (
                  <img
                    key={photo.id}
                    src={photo.url}
                    alt=""
                    className="aspect-square w-full rounded-lg border border-neutral-800 object-cover"
                  />
                ),
            )}
          </div>
        )}

        {entry.attachments.length > 0 && (
          <div className="space-y-1.5">
            {entry.attachments.map(
              (attachment) =>
                attachment.url && (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300 hover:border-violet-700"
                  >
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                    {attachment.originalFileName}
                  </a>
                ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
