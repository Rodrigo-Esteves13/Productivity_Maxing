import { useEffect, useState, type ReactNode } from 'react';
import AccountBlockedPage from './AccountBlockedPage';
import { ACCOUNT_BLOCKED_EVENT } from '../../lib/accountBlockedEvents';

interface AccountBlockedGateProps {
  children: ReactNode;
}

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

  if (triggered) {
    return <AccountBlockedPage />;
  }

  return <>{children}</>;
}
