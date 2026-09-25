import { useCallback, useEffect, useState } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { ShieldIcon, AlertTriangleIcon, ClockIcon } from '../UI/Icons';
import { getMyAccountStatus, submitAppeal, logoutRequest } from '../../api/userService';
import type { AccountStatusInfo } from '../../types/models';

interface AccountBlockedPageProps {
  // Só vem preenchido no caso "bloqueado logo no login" (ver Login.tsx) -
  // não existe cookie de sessão nesse caso, este token de 15 min é o que
  // autentica os pedidos abaixo em vez dele (ver JwtBlockedAwareStrategy
  // no backend). Quando undefined (caso "bloqueado a meio de uma sessão",
  // ver AccountBlockedGate.tsx), o cookie normal resolve sozinho.
  bearerToken?: string;
  // Mensagem curta já disponível de imediato (vem do próprio erro que
  // disparou este ecrã) - mostrada enquanto o fetch de baixo carrega os
  // detalhes completos, para o ecrã nunca ficar em branco.
  initialMessage?: string;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: AccountStatusInfo };

// Mesmo intervalo do poll em AccountBlockedGate.tsx - aqui é o lado "já
// estou no ecrã de bloqueio", para uma appeal resolvida (ou o
// suspend/ban ser levantado diretamente) aparecer sozinha, sem precisar
// de refresh manual.
const STATUS_POLL_INTERVAL_MS = 30000;

function formatDate(value: string | null): string {
  if (!value) return 'an unknown date';
  return new Date(value).toLocaleString();
}

export default function AccountBlockedPage({
  bearerToken,
  initialMessage,
}: AccountBlockedPageProps) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Sobrepõe-se ao que veio do fetch assim que o submit é bem sucedido,
  // para o ecrã passar a "pendente" sem precisar de um segundo pedido.
  const [justSubmittedAt, setJustSubmittedAt] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoad({ status: 'loading' });
    try {
      const data = await getMyAccountStatus(bearerToken);
      setLoad({ status: 'loaded', data });
    } catch {
      setLoad({ status: 'error' });
    }
  }, [bearerToken]);

  // Same request as fetchStatus, but doesn't flash the "Loading
  // details..." state on every tick - used by the background poll below,
  // where the screen already has content on it and a refresh every 30s
  // shouldn't blank it out. Failures are ignored: this is a background
  // refresh, the manual "Try again" path already covers real errors.
  const refreshSilently = useCallback(async () => {
    try {
      const data = await getMyAccountStatus(bearerToken);
      setLoad({ status: 'loaded', data });
    } catch {
      // ignore - next tick tries again
    }
  }, [bearerToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // While still restricted, poll in the background so a resolved appeal
  // (or the restriction being lifted outright) shows up on its own
  // instead of requiring a manual reload.
  useEffect(() => {
    if (load.status !== 'loaded' || load.data.status === 'ACTIVE') return;
    const interval = setInterval(refreshSilently, STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load, refreshSilently]);

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } catch {
      // A conta já está bloqueada - mesmo que o pedido de logout falhe,
      // continuamos para /login. Não há aqui nada de novo para o user
      // fazer sobre isso.
    }
    window.location.href = '/login';
  };

  const handleSubmit = async () => {
    if (message.trim().length < 20) {
      setSubmitError('Please write at least 20 characters explaining your appeal.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitAppeal(message.trim(), bearerToken);
      setJustSubmittedAt(result.createdAt);
      // Catches the server up quickly so `data.appeal` reflects the new
      // appeal - see AccountBlockedDetails below for why that matters
      // once the background poll starts running.
      refreshSilently();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const backendMessage = (
        err as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      if (status === 409 && backendMessage) {
        setSubmitError(backendMessage);
      } else {
        setSubmitError('Could not submit your appeal. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-950 border border-red-900">
          <ShieldIcon className="h-8 w-8 text-red-400" />
        </div>

        {load.status === 'loading' && (
          <>
            <h1 className="text-2xl font-semibold text-white mb-2">Account restricted</h1>
            <p className="text-neutral-400">{initialMessage ?? 'Loading details...'}</p>
          </>
        )}

        {load.status === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-white mb-2">Account restricted</h1>
            <p className="text-neutral-400 mb-6">
              {initialMessage ??
                'Your account has been restricted, and we could not load the full details.'}
            </p>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={fetchStatus}>
                Try again
              </Button>
              <Button onClick={handleLogout}>Log out</Button>
            </div>
          </>
        )}

        {load.status === 'loaded' && load.data.status === 'ACTIVE' && (
          <>
            <h1 className="text-2xl font-semibold text-white mb-2">
              You&apos;re no longer restricted
            </h1>
            <p className="text-neutral-400 mb-6">
              Your account status has changed. Reload the page to continue.
            </p>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </>
        )}

        {load.status === 'loaded' && load.data.status !== 'ACTIVE' && (
          <AccountBlockedDetails
            data={load.data}
            message={message}
            setMessage={setMessage}
            submitting={submitting}
            submitError={submitError}
            justSubmittedAt={justSubmittedAt}
            onSubmit={handleSubmit}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

interface DetailsProps {
  data: AccountStatusInfo;
  message: string;
  setMessage: (value: string) => void;
  submitting: boolean;
  submitError: string | null;
  justSubmittedAt: string | null;
  onSubmit: () => void;
  onLogout: () => void;
}

function AccountBlockedDetails({
  data,
  message,
  setMessage,
  submitting,
  submitError,
  justSubmittedAt,
  onSubmit,
  onLogout,
}: DetailsProps) {
  const isBanned = data.status === 'BANNED';

  // Um appeal "em vigor" é o que o backend já confirma como não resolvido
  // (data.appeal), com justSubmittedAt só como um fallback otimista para
  // a janela curta entre o submit e o refreshSilently que o segue - ver
  // handleSubmit. Sem essa ordem de prioridade, o poll em segundo plano
  // nunca conseguiria mostrar uma resolução: justSubmittedAt continuaria
  // a "ganhar" para sempre depois de o utilizador submeter uma vez.
  const pendingAppeal =
    data.appeal && !data.appeal.resolvedAt
      ? data.appeal
      : !data.appeal && justSubmittedAt
        ? { createdAt: justSubmittedAt }
        : null;
  const resolvedAppeal = !pendingAppeal && data.appeal?.resolvedAt ? data.appeal : null;

  return (
    <>
      <h1 className="text-2xl font-semibold text-white mb-2">
        {isBanned ? 'Account banned' : 'Account suspended'}
      </h1>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 mb-6 text-left space-y-2">
        {!isBanned && (
          <div className="flex items-start gap-2 text-sm text-neutral-300">
            <ClockIcon className="h-4 w-4 shrink-0 mt-0.5 text-neutral-500" />
            <span>Suspended until {formatDate(data.suspendedUntil)}</span>
          </div>
        )}
        <div className="flex items-start gap-2 text-sm text-neutral-300">
          <AlertTriangleIcon className="h-4 w-4 shrink-0 mt-0.5 text-neutral-500" />
          <span>{data.statusReason || 'No reason was given.'}</span>
        </div>
        <p className="text-xs text-neutral-500 pt-1">
          Last updated {formatDate(data.statusUpdatedAt)}
        </p>
      </div>

      {pendingAppeal && (
        <p className="text-sm text-neutral-400 mb-6">
          Your appeal was submitted on {formatDate(pendingAppeal.createdAt)} and is awaiting
          review.
        </p>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'DENIED' && (
        <div className="text-left mb-4">
          <p className="text-sm text-neutral-400 mb-4">
            Your previous appeal was denied on {formatDate(resolvedAppeal.resolvedAt)}
            {resolvedAppeal.resolutionNote ? `: ${resolvedAppeal.resolutionNote}` : '.'}
          </p>
        </div>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'APPROVED' && (
        <p className="text-sm text-neutral-400 mb-6">
          Your appeal was approved on {formatDate(resolvedAppeal.resolvedAt)}. Reload the page to
          continue.
        </p>
      )}

      {!pendingAppeal && (
        <div className="text-left mb-6">
          <Textarea
            label="Appeal this decision"
            placeholder="Explain why you believe this suspension/ban should be reconsidered..."
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
          />
          {submitError && <p className="mt-2 text-sm text-red-400">{submitError}</p>}
          <Button className="mt-3 w-full" onClick={onSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit appeal'}
          </Button>
        </div>
      )}

      <Button variant="secondary" onClick={onLogout}>
        Log out
      </Button>
    </>
  );
}
