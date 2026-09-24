// Dispatched on `window` by api/client.ts's response interceptor the
// moment a 401 with { code: 'ACCOUNT_BLOCKED' } comes back from the
// backend for an already-authenticated request (see JwtStrategy on the
// backend, which checks this on every request via AccountStatusService) -
// AccountBlockedGate listens for this and swaps the whole app out for
// AccountBlockedPage. Same pattern as maintenanceEvents.ts - the
// interceptor lives outside the component tree, so a DOM event is the
// natural bridge.
//
// Note this only covers the MID-SESSION case (a valid cookie that gets
// blocked on a later request). The LOGIN-time case (blocked before any
// session exists) never fires this event - Login.tsx catches that error
// directly and renders AccountBlockedPage itself, since it already has
// the appealToken it needs right there in the response body.
export const ACCOUNT_BLOCKED_EVENT = 'pmaxing:account-blocked-detected';
