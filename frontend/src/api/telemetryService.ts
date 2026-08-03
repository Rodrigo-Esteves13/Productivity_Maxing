import api from './client';

// Both of these are fire-and-forget by design: a failed telemetry report
// must never itself throw into an ErrorBoundary that's already handling a
// crash, or into the web-vitals callback. Swallow anything that goes
// wrong here silently - a lost metric or crash report is a "fewer than
// ideal" problem, not one worth showing the user or ever breaking a
// call site over.

export function reportClientError(payload: {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
}): void {
  api.post('/telemetry/client-error', payload).catch(() => {});
}

export function reportWebVital(payload: {
  name: string;
  value: number;
  id: string;
  url: string;
}): void {
  api.post('/telemetry/web-vitals', payload).catch(() => {});
}
