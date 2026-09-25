import { useEffect, useState, type ReactNode } from 'react';
import AccountBlockedPage from './AccountBlockedPage';
import { ACCOUNT_BLOCKED_EVENT } from '../../lib/accountBlockedEvents';
import { getMyAccountStatus } from '../../api/userService';

interface AccountBlockedGateProps {
  children: ReactNode;
}

// Intervalo do poll de fallback abaixo - mesma ordem de grandeza que
// useHealthCheck.ts (30s), sem precisar de ser mais agressivo que isso.
const STATUS_POLL_INTERVAL_MS = 30000;

// Wraps the whole app, inside MaintenanceGate (see App.tsx) - covers the
// MID-SESSION case: a valid cookie that gets rejected as SUSPENDED/BANNED
// on some later request (see api/client.ts's interceptor). The LOGIN-time
// case never reaches here - Login.tsx handles that one directly, since it
// already has the appealToken it needs from the failed login response.
//
// No bearerToken passed here - AccountBlockedPage falls back to the
// normal session cookie, which JwtBlockedAwareGuard still accepts even
// though the account is blocked (see the comment there for why that's
// safe). Stays blocked for the rest of this page load once triggered -
// "Log out" (inside AccountBlockedPage) is the way out.
export default function AccountBlockedGate({ children }: AccountBlockedGateProps) {
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const handleBlocked = () => setTriggered(true);
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, handleBlocked);
    return () => window.removeEventListener(ACCOUNT_BLOCKED_EVENT, handleBlocked);
  }, []);

  // The event above only fires when some OTHER request happens to get
  // rejected - an idle tab (no navigation, no background fetch) could sit
  // for a long time after an admin bans/suspends the account without
  // noticing. This poll catches that directly instead of waiting for a
  // coincidental failed request. Errors are ignored on purpose - a
  // logged-out visitor hits this same endpoint's guard and gets a plain
  // 401 (not the ACCOUNT_BLOCKED code), which just means "not our case".
  useEffect(() => {
    if (triggered) return;

    const interval = setInterval(async () => {
      try {
        const status = await getMyAccountStatus();
        if (status.status !== 'ACTIVE') setTriggered(true);
      } catch {
        // Not authenticated yet, or a transient network error - nothing
        // to do here, the next tick tries again.
      }
    }, STATUS_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [triggered]);

  if (triggered) {
    return <AccountBlockedPage />;
  }

  return <>{children}</>;
}
