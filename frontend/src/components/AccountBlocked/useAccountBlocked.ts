import { useCallback, useEffect, useState } from 'react';
import { getMyAccountStatus, submitAppeal } from '../../api/accountStatusService';
import { logoutRequest } from '../../api/authService';
import { clearUserStorage } from '../../lib/storageKeys';
import { getHttpStatus } from '../../lib/httpError';
import { POLL_MS } from '../../lib/pollIntervals';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';
import type { AccountStatusInfo } from '../../types/models';

export type LoadState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'loaded'; data: AccountStatusInfo };

// Mesmo intervalo do poll em AccountStatusWatcher.tsx - aqui é o lado "já
// estou no ecrã de bloqueio", para uma appeal resolvida (ou o
// suspend/ban ser levantado diretamente) aparecer sozinha, sem precisar
// de refresh manual. Também é o que faz a contagem decrescente abaixo
// avançar sem precisar de um segundo timer só para isso.
const STATUS_POLL_INTERVAL_MS = POLL_MS.accountBlockedStatus;

// Minimo de caracteres para um appeal ser enviado.
const APPEAL_MIN_LENGTH = 20;

// Estado da conta (com poll), envio do appeal e logout.
export function useAccountBlocked(bearerToken: string | undefined) {
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
  useVisibleInterval(() => void refreshSilently(), STATUS_POLL_INTERVAL_MS, {
    enabled: load.status === 'loaded' && load.data.status !== 'ACTIVE',
  });

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } catch {
      // A conta já está bloqueada - mesmo que o pedido de logout falhe,
      // continuamos para /login. Não há aqui nada de novo para o user
      // fazer sobre isso.
    }
    clearUserStorage();
    window.location.href = '/login';
  };

  const handleSubmit = async () => {
    if (message.trim().length < APPEAL_MIN_LENGTH) {
      setSubmitError(`Please write at least ${APPEAL_MIN_LENGTH} characters explaining your appeal.`);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitAppeal(message.trim(), bearerToken);
      setJustSubmittedAt(result.createdAt);
      // Catches the server up quickly so `data.appeal` reflects the new
      // appeal - see appealState in lib/accountBlocked for why that matters
      // once the background poll starts running.
      refreshSilently();
    } catch (err) {
      const status = getHttpStatus(err);
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

  return {
    load,
    message,
    setMessage,
    submitting,
    submitError,
    justSubmittedAt,
    fetchStatus,
    handleSubmit,
    handleLogout,
  };
}
