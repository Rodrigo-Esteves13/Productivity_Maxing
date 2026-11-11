// Avisos push periodicos que se podem desligar um a um. Espelha
// MUTABLE_PUSH_KEYS do backend (push/push-messages.ts): o backend rejeita
// qualquer valor fora desta lista.
export const MUTABLE_PUSH_KINDS = [
  'streakRisk',
  'dueTodayDigest',
  'moneyReminder',
  'budgetWarn',
  'budgetOver',
  'leisureBudgetWarn',
  'leisureBudgetOver',
  'absenceLimitNear',
  'gradeAlmostThere',
  'accountAnniversary',
] as const;

export type MutablePushKind = (typeof MUTABLE_PUSH_KINDS)[number];

/** Nova lista de tipos desligados depois de ligar/desligar um. */
export function toggleMutedKind(muted: readonly string[], kind: MutablePushKind, enabled: boolean): string[] {
  const rest = muted.filter((k) => k !== kind);
  return enabled ? rest : [...rest, kind];
}
