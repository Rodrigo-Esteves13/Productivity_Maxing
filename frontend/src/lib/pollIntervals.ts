// Intervalos de polling (ms) num so sitio (F-53), em vez de numeros magicos.
export const POLL_MS = {
  accountBlockedStatus: 30_000,
  friendHub: 30_000,
  myShares: 30_000,
  notesAccess: 20_000,
  social: 20_000,
  socialPending: 60_000,
  sharedEntryGate: 8_000,
} as const;
