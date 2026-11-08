export type OverallStatus = 'ok' | 'degraded' | 'down';
export type CheckState = 'ok' | 'fail';

export interface StatusCheck {
  id: 'api' | 'database';
  state: CheckState;
}

export interface StatusSnapshot {
  overall: OverallStatus;
  checks: StatusCheck[];
  uptimeSeconds: number | null;
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;

// Backend unreachable (network error, timeout, non-JSON gateway error).
export const DOWN_SNAPSHOT: StatusSnapshot = { overall: 'down', checks: [], uptimeSeconds: null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Turns the /health/ready response (200 ok, or 503 with the same body when
// the database is unreachable) into what the status page shows. A response
// that is not our health payload (proxy 502/504 page) counts as down.
export function deriveStatus(httpOk: boolean, body: unknown): StatusSnapshot {
  if (!isRecord(body) || (body.status !== 'ok' && body.status !== 'error')) {
    return DOWN_SNAPSHOT;
  }
  const databaseConnected = body.database === 'connected';
  const uptime = typeof body.uptime === 'number' && Number.isFinite(body.uptime) ? body.uptime : null;
  const healthy = httpOk && body.status === 'ok' && databaseConnected;
  return {
    overall: healthy ? 'ok' : 'degraded',
    checks: [
      { id: 'api', state: 'ok' },
      { id: 'database', state: databaseConnected ? 'ok' : 'fail' },
    ],
    uptimeSeconds: uptime,
  };
}

export function formatUptime(seconds: number): { days: number; hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(seconds));
  return {
    days: Math.floor(total / SECONDS_PER_DAY),
    hours: Math.floor((total % SECONDS_PER_DAY) / SECONDS_PER_HOUR),
    minutes: Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
  };
}
