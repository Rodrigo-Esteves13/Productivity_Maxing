import { useEffect, useRef, useState } from 'react';
import { useLiveRefresh } from '../hooks/useLiveRefresh';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getSharedNotebookEntry, requestShareAccess, respondToInvitation } from '../api/notebookService';
import { fetchCsrfToken } from '../api/userService';
import { setCsrfToken } from '../api/csrfStore';
import type { SharedEntryContext, SharedNotebookEntry as SharedNotebookEntryData, SharedRole } from '../types/models';
import { useDrawingCanvas } from '../hooks/useDrawingCanvas';
import { useCanvasShapes } from '../hooks/useCanvasShapes';
import { useCanvasLinks } from '../hooks/useCanvasLinks';
import { useCanvasTexts } from '../hooks/useCanvasTexts';
import NotebookCanvas from '../components/Notebook/NotebookCanvas';
import NotebookPhotoGrid from '../components/Notebook/entry/NotebookPhotoGrid';
import AttachmentActions from '../components/Notebook/entry/AttachmentActions';
import AttachmentPreviewModal from '../components/Notebook/entry/AttachmentPreviewModal';
import type { PreviewableFile } from '../components/Notebook/entry/attachmentPreview';
import PageLayout from '../components/Layout/PageLayout';
import NotebookTableEditor from '../components/Notebook/NotebookTableEditor';
import EntrySheet from '../components/Notebook/entry/EntrySheet';
import EntrySectionHeader from '../components/Notebook/entry/EntrySectionHeader';
import { LinkIcon, FileIcon, BookOpenIcon, PencilIcon, ShieldIcon } from '../components/UI/Icons';
import Button from '../components/UI/Button';
import SharedEntryEditForm from '../components/Notebook/SharedEntryEditForm';
import { useI18n } from '../i18n/useI18n';
import DocumentSkeleton from '../components/UI/DocumentSkeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { notifySocialChanged } from '../lib/socialEvents';
import Breadcrumbs from '../components/UI/Breadcrumbs';
import PersonAvatar from '../components/Social/PersonAvatar';
import { friendPath, notebookEntryPath, socialTabPath } from '../lib/appLinks';

const noop = () => {};

// Usa o mesmo PageLayout (header + footer) das restantes páginas, para quem
// abre um link partilhado - mesmo sem conta - ver a app inteira à volta e
// não um ecrã solto. É a única página pensada para alguém sem conta.
type ShareGateStatus = 'login_required' | 'not_requested' | 'pending' | 'invited' | 'denied';

// Os links das fotos/anexos expiram em 1 h (backend). Numa pagina aberta
// muito tempo recarrega-se a entrada antes disso; a verificacao e barata e
// so pede ao servidor quando a copia ja tem 50 min (cada leitura conta como
// visita, por isso nunca a cada foco).
const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000;
const SIGNED_URL_CHECK_MS = 60 * 1000;

export default function SharedNotebookEntry() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [entry, setEntry] = useState<SharedNotebookEntryData | null>(null);
  const [role, setRole] = useState<SharedRole>('VIEWER');
  const [hasPendingProposal, setHasPendingProposal] = useState(false);
  const [context, setContext] = useState<SharedEntryContext | null>(null);
  const [gateStatus, setGateStatus] = useState<ShareGateStatus | null>(null);
  const [inviteRequestId, setInviteRequestId] = useState<string | null>(null);
  const navigate = useNavigate();
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
  const loadedAtRef = useRef(0);

  // silent = refresh em segundo plano (polling/push): sem spinner e sem
  // mostrar erro por uma falha de rede passageira.
  const load = (silent = false) => {
    if (!token) return;
    if (!silent) {
      setIsLoading(true);
      setError('');
    }
    getSharedNotebookEntry(token)
      .then((result) => {
        if (result.status === 'ok') {
          loadedAtRef.current = Date.now();
          setEntry(result.entry);
          setRole(result.role);
          setHasPendingProposal(result.hasPendingProposal);
          setContext(result.context);
          setGateStatus(null);
        } else {
          setEntry(null);
          setGateStatus(result.status);
          setInviteRequestId(result.status === 'invited' ? result.requestId : null);
        }
      })
      .catch(() => {
        if (!silent) setError(t('ui.shareLinkInvalid'));
      })
      .finally(() => {
        if (!silent) setIsLoading(false);
      });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- load() so depende de `token`
  useEffect(() => load(), [token]);

  // Pedido pendente/negado: atualiza sozinho quando o dono decide (antes era
  // preciso F5 para ver a aprovacao).
  useLiveRefresh(() => load(true), { enabled: gateStatus === 'pending', intervalMs: 8000 });
  useLiveRefresh(
    () => {
      if (Date.now() - loadedAtRef.current > SIGNED_URL_REFRESH_MS) load(true);
    },
    { enabled: entry !== null, intervalMs: SIGNED_URL_CHECK_MS },
  );

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
        // O JWT de acesso (15 min) pode ter sido renovado agora mesmo: o
        // primeiro pedido da entrada pode ter saido como anonimo. Volta a
        // pedir em silencio para uma partilha so para contas abrir logo.
        load(true);
      })
      .catch(() => setHasSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- so no mount
  }, []);

  useDocumentTitle(entry ? t('ui.sharedEntryTitle', { title: entry.title }) : t('ui.sharedLesson'));

  const handleRequestAccess = async () => {
    if (!token) return;
    setIsRequesting(true);
    setError('');
    try {
      await requestShareAccess(token);
      load();
    } catch {
      setError(t('ui.couldNotSendTheRequest'));
    } finally {
      setIsRequesting(false);
    }
  };

 // Convite do dono: aceitar abre a nota, recusar volta ao Social.
  const handleInvitation = async (accept: boolean) => {
    if (!inviteRequestId) return;
    setIsRequesting(true);
    setError('');
    try {
      await respondToInvitation(inviteRequestId, accept);
      notifySocialChanged();
      if (accept) load();
      else navigate('/social');
    } catch {
      setError(t('sharedWithMe.invite.error'));
    } finally {
      setIsRequesting(false);
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <DocumentSkeleton />
      </PageLayout>
    );
  }

  if (gateStatus) {
    return (
      <PageLayout>
        <ShareAccessGate
          status={gateStatus}
          token={token ?? ''}
          hasSession={hasSession}
          isRequesting={isRequesting}
          error={error}
          onRequestAccess={handleRequestAccess}
          onInvitation={handleInvitation}
        />
      </PageLayout>
    );
  }

  if (error || !entry) {
    return (
      <PageLayout>
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center">
          <BookOpenIcon className="h-8 w-8 text-neutral-700" />
          <p className="text-sm text-neutral-400">{error || t('ui.shareLinkInvalid')}</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {hasSession && <SharedEntryNav title={entry.title} context={context} />}
      <SharedNotebookEntryView
        entry={entry}
        token={token ?? ''}
        role={role}
        hasPendingProposal={hasPendingProposal}
        onChanged={() => load()}
      />
    </PageLayout>
  );
}

// Onde estas e para onde ir a seguir (so com sessao): o dono volta ao seu
// caderno; quem recebeu volta a "Partilhado comigo" e, se for amigo do dono,
// ve quem partilhou e vai a pagina dessa pessoa.
function SharedEntryNav({ title, context }: { title: string; context: SharedEntryContext | null }) {
  const { t } = useI18n();
  const ownEntryId = context?.ownEntryId ?? null;
  const owner = context?.owner ?? null;
  const ownerName = owner?.name?.trim() || t('social.anonymous');
  return (
    <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <Breadcrumbs
        className="mb-0"
        items={
          ownEntryId
            ? [{ label: t('nav.notebook'), to: '/notebook' }, { label: title }]
            : [
                { label: t('nav.social'), to: socialTabPath('friends') },
                { label: t('nav.sharedWithMe'), to: socialTabPath('shared') },
                { label: title },
              ]
        }
      />
      {ownEntryId ? (
        <Link
          to={notebookEntryPath(ownEntryId, { share: true })}
          className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-200 hover:border-violet-700 hover:text-white"
        >
          {t('shared.nav.openInNotebook')}
        </Link>
      ) : owner ? (
        <Link
          to={friendPath(owner.userId)}
          className="flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 py-1 pl-1 pr-3 text-sm text-neutral-300 hover:border-violet-700 hover:text-white"
        >
          <PersonAvatar name={ownerName} avatarUrl={owner.avatarUrl} size="sm" />
          {t('shared.nav.sharedBy', { name: ownerName })}
        </Link>
      ) : null}
    </div>
  );
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
  onInvitation,
}: {
  status: ShareGateStatus;
  token: string;
  hasSession: boolean;
  isRequesting: boolean;
  error: string;
  onRequestAccess: () => void;
  onInvitation: (accept: boolean) => void;
}) {
  const { t } = useI18n();
  const redirectPath = `/shared/${token}`;

  const copy: Record<ShareGateStatus, { title: string; body: string }> = {
    login_required: {
      title: t('ui.logInToViewThis'),
      body: t('ui.theOwnerOnlyAllowsPeople'),
    },
    not_requested: {
      title: t('ui.accessRequired'),
      body: t('ui.thisLessonIsOnlyVisible'),
    },
    pending: {
      title: t('ui.requestSent'),
      body: t('ui.yourRequestIsWaitingFor'),
    },
    invited: {
      title: t('share.gate.invited.title'),
      body: t('share.gate.invited.body'),
    },
    denied: {
      title: t('ui.requestDenied'),
      body: t('ui.theOwnerDidNotApprove'),
    },
  };

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <ShieldIcon className="h-8 w-8 text-neutral-700" />
      <h1 className="text-base font-semibold text-white">{copy[status].title}</h1>
      <p className="max-w-sm text-sm text-neutral-400">{copy[status].body}</p>
      {error && <p className="text-xs text-red-400">{error}</p>}

      {status === 'login_required' && (
        <a
          href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          {t('ui.logIn')}
        </a>
      )}

      {status === 'pending' && hasSession && <GateNotifyButton />}

      {status === 'invited' && hasSession && (
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => onInvitation(true)}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {t('sharedWithMe.invite.accept')}
          </button>
          <button
            type="button"
            disabled={isRequesting}
            onClick={() => onInvitation(false)}
            className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {t('sharedWithMe.invite.decline')}
          </button>
        </div>
      )}

      {(status === 'not_requested' || status === 'denied') && hasSession && (
        <button
          type="button"
          disabled={isRequesting}
          onClick={onRequestAccess}
          className="mt-1 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {isRequesting ? t('auth.sending') : status === 'denied' ? t('ui.requestAgain') : t('ui.requestAccess')}
        </button>
      )}
    </div>
  );
}

// Pedido pendente: oferece ligar os avisos push neste dispositivo para o
// requerente saber logo que o dono decide (so aparece se ainda estao desligados).
function GateNotifyButton() {
  const { t } = useI18n();
  const { state, isBusy, enable } = usePushNotifications();
  if (state !== 'off') return null;
  return (
    <div className="mt-1 flex flex-col items-center gap-2">
      <p className="max-w-sm text-xs text-neutral-500">{t('share.gate.notifyMe')}</p>
      <button
        type="button"
        disabled={isBusy}
        onClick={() => void enable()}
        className="rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
      >
        {t('push.enable')}
      </button>
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
export function SharedNotebookEntryView({
  entry,
  token,
  role,
  hasPendingProposal,
  onChanged,
}: {
  entry: SharedNotebookEntryData;
  token: string;
  role: SharedRole;
  hasPendingProposal: boolean;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [justProposed, setJustProposed] = useState(false);
  const [previewing, setPreviewing] = useState<PreviewableFile | null>(null);
  // O dono edita no proprio Notebook; aqui so editor e co-owner editam.
  const canEdit = role === 'EDITOR' || role === 'CO_OWNER';
  const isProposal = role === 'EDITOR';
  const bannerKey =
    role === 'CO_OWNER' ? 'sharedEdit.banner.coOwner' : role === 'EDITOR' ? 'sharedEdit.banner.editor' : null;
  const canvas = useDrawingCanvas(entry.drawingStrokes ?? []);
  const shapeLayer = useCanvasShapes(entry.canvasShapes ?? []);
  const linkLayer = useCanvasLinks(entry.canvasLinks ?? []);
  const textLayer = useCanvasTexts(entry.canvasTexts ?? []);

  const hasCanvas =
    (entry.drawingStrokes?.length ?? 0) > 0 ||
    (entry.canvasShapes?.length ?? 0) > 0 ||
    (entry.canvasTexts?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-md border border-violet-900/50 bg-violet-950/30 px-3 py-1.5 text-center text-xs text-violet-300">
          {bannerKey ? t(bannerKey) : t('ui.sharedReadOnlyViewProductivity')}
        </div>

        {isProposal && (hasPendingProposal || justProposed) && (
          <p role="status" className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-1.5 text-center text-xs text-amber-300">
            {t('sharedEdit.pending')}
          </p>
        )}

        {canEdit && !isEditing && (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              onClick={() => setIsEditing(true)}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              {isProposal ? t('sharedEdit.suggest') : t('sharedEdit.edit')}
            </Button>
          </div>
        )}

        <EntrySheet toolbar={null}>
        {canEdit && isEditing ? (
          <SharedEntryEditForm
            token={token}
            isProposal={isProposal}
            initialTitle={entry.title}
            initialText={entry.textContent ?? ''}
            baseUpdatedAt={entry.updatedAt}
            onCancel={() => setIsEditing(false)}
            onDone={(applied) => {
              setIsEditing(false);
              if (applied) onChanged();
              else setJustProposed(true);
            }}
          />
        ) : (
        <>
        <div className="space-y-1">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${entry.area.colorHex}22`,
              // Mesmo truque do PriorityBadge: a cor da area sozinha pode nao ler bem.
              color: `color-mix(in oklab, ${entry.area.colorHex} 50%, var(--color-neutral-100))`,
            }}
          >
            {entry.area.name}
          </span>
          <h1 className="break-words font-serif text-2xl font-semibold leading-tight text-white sm:text-3xl">{entry.title}</h1>
          <p className="text-xs text-neutral-500">{new Date(entry.date).toLocaleDateString()}</p>
        </div>

        {entry.textContent && (
          <section>
            <EntrySectionHeader icon={PencilIcon} title={t('notebook.section.notes')} />
            <div className="notebook-ruled max-w-prose whitespace-pre-wrap break-words font-serif text-base text-neutral-100">
              {entry.textContent}
            </div>
          </section>
        )}
        </>
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
          <section>
            <EntrySectionHeader icon={LinkIcon} title={t('ui.usefulLinks')} />
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
          </section>
        )}

        <NotebookPhotoGrid photos={entry.photos} className="grid grid-cols-2 gap-2 sm:grid-cols-3" />

        {entry.attachments.length > 0 && (
          <div className="space-y-1.5">
            {entry.attachments.map(
              (attachment) =>
                attachment.url && (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-300"
                  >
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                    <span className="min-w-0 flex-1 truncate" title={attachment.originalFileName}>
                      {attachment.originalFileName}
                    </span>
                    <AttachmentActions attachment={attachment} onPreview={setPreviewing} />
                  </div>
                ),
            )}
          </div>
        )}
        <AttachmentPreviewModal attachment={previewing} onClose={() => setPreviewing(null)} />
        </EntrySheet>
    </div>
  );
}
