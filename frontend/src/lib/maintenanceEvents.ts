// Dispatched on `window` by api/client.ts's response interceptor the
// moment a 503 with { code: 'MAINTENANCE_MODE' } comes back from the
// backend (see MaintenanceGuard on the backend) - MaintenanceGate listens
// for this and swaps the whole app out for MaintenancePage. A plain
// CustomEvent instead of lifting this into a React context: the
// interceptor lives outside the component tree entirely, so a DOM event
// is the natural bridge - same pattern the command palette already uses
// for its own cross-component "open" trigger (see CommandPalette.tsx).
export const MAINTENANCE_EVENT = 'pmaxing:maintenance-detected';
