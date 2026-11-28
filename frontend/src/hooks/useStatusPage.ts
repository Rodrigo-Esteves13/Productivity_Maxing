import { useCallback, useRef, useState } from 'react';
import { rawFetch } from '../api/client';
import { useVisibleInterval } from './useVisibleInterval';
import { DOWN_SNAPSHOT, deriveStatus, type StatusSnapshot } from '../lib/statusDerive';

const STATUS_PATH = '/health/ready';
export const STATUS_POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 8000;

export interface StatusPageState {
  snapshot: StatusSnapshot | null;
  responseMs: number | null;
  lastChecked: Date | null;
  isChecking: boolean;
  refresh: () => void;
}

// Public status page data. rawFetch on purpose: no auth cookies and no 401
// logout interceptor (same reasoning as useHealthCheck). Polls every 30 s
// while the tab is visible (useVisibleInterval); resumes with an immediate check when it returns.
export default function useStatusPage(): StatusPageState {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const inFlight = useRef(false);

  const run = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setIsChecking(true);
    const started = performance.now();
    let next: StatusSnapshot = DOWN_SNAPSHOT;
    let elapsed: number | null = null;
    try {
      const response = await rawFetch(STATUS_PATH, { timeoutMs: REQUEST_TIMEOUT_MS });
      elapsed = Math.round(performance.now() - started);
      const body: unknown = await response.json().catch(() => null);
      next = deriveStatus(response.ok, body);
    } catch {
      next = DOWN_SNAPSHOT;
    }
    setSnapshot(next);
    setResponseMs(next.overall === 'down' ? null : elapsed);
    setLastChecked(new Date());
    setIsChecking(false);
    inFlight.current = false;
  }, []);

  // So corre com o separador visivel; ao voltar, corre logo se ja passou um intervalo.
  useVisibleInterval(() => void run(), STATUS_POLL_INTERVAL_MS, { immediate: true });

  const refresh = useCallback(() => {
    void run();
  }, [run]);

  return { snapshot, responseMs, lastChecked, isChecking, refresh };
}
