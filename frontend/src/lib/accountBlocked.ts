// Regras puras do ecra de conta bloqueada.
import { MINUTES_PER_DAY, MINUTES_PER_HOUR, MS_PER_MINUTE } from './timeConstants';
import type { AccountStatusInfo } from '../types/models';

export type BlockedSeverity = 'banned' | 'suspended' | 'lifted' | 'neutral';

// null = ainda sem dados.
export function blockedSeverity(status: AccountStatusInfo['status'] | null): BlockedSeverity {
  if (status === null) return 'neutral';
  if (status === 'BANNED') return 'banned';
  return status === 'SUSPENDED' ? 'suspended' : 'lifted';
}

// "3d 4h", "6h 12m", "12m" - usado tanto para o tempo até ao fim da
// suspensão como para o cooldown até ao 3º appeal. Arredondado para
// minutos: não vale a pena um timer a marcar segundos aqui.
export function formatRemaining(targetIso: string, now: number = Date.now()): string {
  const ms = new Date(targetIso).getTime() - now;
  if (ms <= 0) return 'any moment now';
  const minutes = Math.floor(ms / MS_PER_MINUTE);
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const mins = minutes % MINUTES_PER_HOUR;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// Um appeal "em vigor" é o que o backend já confirma como não resolvido
// (data.appeal), com justSubmittedAt só como um fallback otimista para
// a janela curta entre o submit e o refresh que o segue. Sem essa ordem
// de prioridade, o poll em segundo plano nunca conseguiria mostrar uma
// resolução: justSubmittedAt continuaria a "ganhar" para sempre depois
// de o utilizador submeter uma vez.
export function appealState(
  data: Pick<AccountStatusInfo, 'appeal' | 'appealAvailability'>,
  justSubmittedAt: string | null,
  now: number = Date.now(),
) {
  const pendingAppeal =
    data.appeal && !data.appeal.resolvedAt
      ? data.appeal
      : !data.appeal && justSubmittedAt
        ? { createdAt: justSubmittedAt }
        : null;
  const resolvedAppeal = !pendingAppeal && data.appeal?.resolvedAt ? data.appeal : null;

  const availability = data.appealAvailability;
  const cooldownActive =
    !!availability?.nextAppealAllowedAt && new Date(availability.nextAppealAllowedAt).getTime() > now;
  const canSubmitNewAppeal = !pendingAppeal && !availability?.appealsExhausted && !cooldownActive;

  return { pendingAppeal, resolvedAppeal, availability, cooldownActive, canSubmitNewAppeal };
}
