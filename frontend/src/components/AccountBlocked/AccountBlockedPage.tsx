import { useCallback, useEffect, useState } from 'react';
import Button from '../UI/Button';
import Textarea from '../UI/Textarea';
import { ShieldIcon, AlertTriangleIcon, ClockIcon } from '../UI/Icons';
import { getMyAccountStatus, submitAppeal, logoutRequest } from '../../api/userService';
import type { AccountStatusInfo, AppealAvailability } from '../../types/models';

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
// de refresh manual. Também é o que faz a contagem decrescente abaixo
// avançar sem precisar de um segundo timer só para isso.
const STATUS_POLL_INTERVAL_MS = 30000;

function formatDate(value: string | null): string {
  if (!value) return 'an unknown date';
  return new Date(value).toLocaleString();
}

// "3d 4h", "6h 12m", "12m" - usado tanto para o tempo até ao fim da
// suspensão como para o cooldown até ao 3º appeal. Arredondado para
// minutos: não vale a pena um timer a marcar segundos aqui.
function formatRemaining(targetIso: string): string {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return 'any moment now';
  const minutes = Math.floor(ms / 60000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
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

  const severity: 'banned' | 'suspended' | 'lifted' | 'neutral' =
    load.status === 'loaded'
      ? load.data.status === 'BANNED'
        ? 'banned'
        : load.data.status === 'SUSPENDED'
          ? 'suspended'
          : 'lifted'
      : 'neutral';

  const HERO_STYLES = {
    banned: {
      band: 'bg-gradient-to-b from-red-950/60 to-black border-red-900/60',
      iconBg: 'bg-red-950 border-red-900',
      iconColor: 'text-red-400',
      eyebrow: 'text-red-400',
    },
    suspended: {
      band: 'bg-gradient-to-b from-amber-950/40 to-black border-amber-900/50',
      iconBg: 'bg-amber-950/70 border-amber-800',
      iconColor: 'text-amber-400',
      eyebrow: 'text-amber-400',
    },
    lifted: {
      band: 'bg-gradient-to-b from-violet-950/40 to-black border-violet-900/50',
      iconBg: 'bg-violet-950/70 border-violet-800',
      iconColor: 'text-violet-400',
      eyebrow: 'text-violet-400',
    },
    neutral: {
      band: 'bg-gradient-to-b from-neutral-900 to-black border-neutral-800',
      iconBg: 'bg-neutral-900 border-neutral-800',
      iconColor: 'text-neutral-400',
      eyebrow: 'text-neutral-400',
    },
  } as const;
  const hero = HERO_STYLES[severity];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Faixa a toda a largura, cor por severidade - a intenção é dar
          logo, de relance, o mesmo peso visual de um ecrã de suspensão
          de uma app grande (Discord/Xbox/Steam), em vez de um cartão
          pequeno perdido no meio de um ecrã preto vazio. */}
      <div className={`w-full border-b ${hero.band}`}>
        <div className="max-w-2xl mx-auto px-6 py-14 sm:py-20 text-center">
          <div
            className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border ${hero.iconBg}`}
          >
            <ShieldIcon className={`h-10 w-10 ${hero.iconColor}`} />
          </div>

          <p className={`text-xs font-semibold tracking-[0.2em] uppercase mb-3 ${hero.eyebrow}`}>
            {severity === 'lifted' && 'Restriction lifted'}
            {severity === 'banned' && 'Account banned'}
            {severity === 'suspended' && 'Account suspended'}
            {severity === 'neutral' && 'Account restricted'}
          </p>

          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">
            {load.status === 'loading' && 'Checking your account'}
            {load.status === 'error' && 'Account restricted'}
            {severity === 'lifted' && "You're back in"}
            {severity === 'suspended' && 'Your access is temporarily on hold'}
            {severity === 'banned' && 'Your access has been permanently revoked'}
          </h1>

          {severity === 'suspended' && load.status === 'loaded' && load.data.suspendedUntil && (
            <p className="mt-3 text-sm text-amber-200/80">
              Time remaining:{' '}
              <span className="font-semibold text-amber-100">
                {formatRemaining(load.data.suspendedUntil)}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Corpo - mesma largura de leitura confortável de um formulário
          normal da app, só que agora claramente separado da faixa de
          cima em vez de tudo espremido num único bloco centrado. */}
      <div className="flex-1 flex justify-center px-6 py-10">
        <div className="max-w-lg w-full">
          {load.status === 'loading' && (
            <p className="text-center text-neutral-400">
              {initialMessage ?? 'Loading details...'}
            </p>
          )}

          {load.status === 'error' && (
            <div className="text-center">
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
            </div>
          )}

          {load.status === 'loaded' && load.data.status === 'ACTIVE' && (
            <div className="text-center">
              <p className="text-neutral-400 mb-6">
                Your account status has changed. Reload the page to continue.
              </p>
              <Button onClick={() => window.location.reload()}>Reload</Button>
            </div>
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
  const accentText = isBanned ? 'text-red-400' : 'text-amber-400';

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

  const availability = data.appealAvailability;
  const cooldownActive =
    !!availability?.nextAppealAllowedAt &&
    new Date(availability.nextAppealAllowedAt).getTime() > Date.now();
  const canSubmitNewAppeal =
    !pendingAppeal && !availability?.appealsExhausted && !cooldownActive;

  return (
    <>
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

      {availability && (
        <AppealProgress availability={availability} accentText={accentText} isBanned={isBanned} />
      )}

      {pendingAppeal && (
        <p className="text-sm text-neutral-400 mb-6">
          Your appeal was submitted on {formatDate(pendingAppeal.createdAt)} and is awaiting
          review.
        </p>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'DENIED' && (
        <p className="text-sm text-neutral-400 mb-4">
          Your previous appeal was denied on {formatDate(resolvedAppeal.resolvedAt)}
          {resolvedAppeal.resolutionNote ? `: ${resolvedAppeal.resolutionNote}` : '.'}
        </p>
      )}

      {resolvedAppeal && resolvedAppeal.resolution === 'APPROVED' && (
        <p className="text-sm text-neutral-400 mb-6">
          Your appeal was approved on {formatDate(resolvedAppeal.resolvedAt)}. Reload the page to
          continue.
        </p>
      )}

      {!pendingAppeal && availability?.appealsExhausted && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 mb-6 text-sm text-neutral-400">
          You&apos;ve used all {availability.maxAppeals} appeals available for this{' '}
          {isBanned ? 'ban' : 'suspension'}. No further appeals can be submitted.
        </div>
      )}

      {!pendingAppeal && !availability?.appealsExhausted && cooldownActive && availability && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 mb-6 text-sm text-neutral-400">
          You can submit your final appeal in{' '}
          <span className={`font-semibold ${accentText}`}>
            {formatRemaining(availability.nextAppealAllowedAt as string)}
          </span>
          .
        </div>
      )}

      {canSubmitNewAppeal && (
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

      <div className="text-center">
        <button
          type="button"
          onClick={onLogout}
          className="text-sm text-neutral-500 hover:text-neutral-300 underline underline-offset-2 transition-colors"
        >
          Log out
        </button>
      </div>
    </>
  );
}

interface AppealProgressProps {
  availability: AppealAvailability;
  accentText: string;
  isBanned: boolean;
}

// Indicador visual de "quantos dos 3 appeals já foram usados" - o tipo de
// stepper que a maioria dos ecrãs de suspensão/ban mostra (contagem
// clara em vez de o utilizador ter de adivinhar quantas tentativas
// ainda tem).
function AppealProgress({ availability, accentText, isBanned }: AppealProgressProps) {
  const filledClass = isBanned ? 'bg-red-600' : 'bg-amber-500';

  return (
    <div className="mb-6">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: availability.maxAppeals }).map((_, index) => (
          <div
            key={index}
            className={`h-1.5 flex-1 rounded-full ${
              index < availability.appealsUsed ? filledClass : 'bg-neutral-800'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-neutral-500">
        <span className={accentText}>{availability.appealsUsed}</span> of{' '}
        {availability.maxAppeals} appeals used
      </p>
    </div>
  );
}
