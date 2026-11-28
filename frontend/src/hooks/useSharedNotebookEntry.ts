import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSharedNotebookEntry, requestShareAccess, respondToInvitation } from '../api/notebookShareService';
import { fetchCsrfToken } from '../api/authService';
import { setCsrfToken } from '../api/csrfStore';
import { useI18n } from '../i18n/useI18n';
import { POLL_MS } from '../lib/pollIntervals';
import * as bus from '../lib/bus';
import useDocumentTitle from './useDocumentTitle';
import { useLiveRefresh } from './useLiveRefresh';
import type { SharedEntryContext, SharedNotebookEntry, SharedRole } from '../types/models';

export type ShareGateStatus = 'login_required' | 'not_requested' | 'pending' | 'invited' | 'denied';

// Os links das fotos/anexos expiram em 1 h (backend). Numa pagina aberta
// muito tempo recarrega-se a entrada antes disso; a verificacao e barata e
// so pede ao servidor quando a copia ja tem 50 min (cada leitura conta como
// visita, por isso nunca a cada foco).
const SIGNED_URL_REFRESH_MS = 50 * 60 * 1000;
const SIGNED_URL_CHECK_MS = 60 * 1000;

// Estado e acoes de uma nota aberta por link partilhado.
export function useSharedNotebookEntry() {
  const { t } = useI18n();
  const { token } = useParams<{ token: string }>();
  const [entry, setEntry] = useState<SharedNotebookEntry | null>(null);
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
  useLiveRefresh(() => load(true), { enabled: gateStatus === 'pending', intervalMs: POLL_MS.sharedEntryGate });
  useLiveRefresh(
    () => {
      if (Date.now() - loadedAtRef.current > SIGNED_URL_REFRESH_MS) load(true);
    },
    { enabled: entry !== null, intervalMs: SIGNED_URL_CHECK_MS },
  );

  useEffect(() => {
    // This page has no AuthProvider around it (see PageLayout usage) so
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

  const requestAccess = async () => {
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
  const respondInvitation = async (accept: boolean) => {
    if (!inviteRequestId) return;
    setIsRequesting(true);
    setError('');
    try {
      await respondToInvitation(inviteRequestId, accept);
      bus.emit('social:changed');
      if (accept) load();
      else navigate('/social');
    } catch {
      setError(t('sharedWithMe.invite.error'));
    } finally {
      setIsRequesting(false);
    }
  };

  return {
    token,
    entry,
    role,
    hasPendingProposal,
    context,
    gateStatus,
    isLoading,
    error,
    hasSession,
    isRequesting,
    reload: () => load(),
    requestAccess,
    respondInvitation,
  };
}
