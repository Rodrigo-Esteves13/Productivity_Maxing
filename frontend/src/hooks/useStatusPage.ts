import { useCallback, useEffect, useRef, useState } from 'react';
import { rawFetch } from '../api/client';
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
// while the tab is visible; resumes with an immediate check when it returns.
export default function useStatusPage(): StatusPageState {
  const [snapshot, setSnapshot] = useState<StatusSnapshot | null>(null);
  const [responseMs, setResponseMs] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const inFlight = useRef(false);
  const lastRun = useRef(0);

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
    lastRun.current = Date.now();
    setSnapshot(next);
    setResponseMs(next.overall === 'down' ? null : elapsed);
    setLastChecked(new Date());
    setIsChecking(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    void run();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run();
    }, STATUS_POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastRun.current >= STATUS_POLL_INTERVAL_MS) {
        void run();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [run]);

  const refresh = useCallback(() => {
    void run();
  }, [run]);

  return { snapshot, responseMs, lastChecked, isChecking, refresh };
}
