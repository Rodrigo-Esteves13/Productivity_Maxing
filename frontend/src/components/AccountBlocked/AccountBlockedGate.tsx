import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { ACCOUNT_BLOCKED_EVENT } from '../../lib/accountBlockedEvents';

// Lazy: so quem tem a conta suspensa/banida descarrega esta pagina.
const AccountBlockedPage = lazy(() => import('./AccountBlockedPage'));

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

  // The event above only fires when some OTHER request happens to get
  // rejected - an idle tab could sit for a long time after an admin
  // bans/suspends the account without noticing. AccountStatusWatcher
  // (inside AuthProvider, see App.tsx) polls for that and fires the same
  // event. It used to live here, outside AuthProvider, and polled for
  // logged-out visitors too - whose plain 401 the api client turned into
  // a redirect to /login.

  if (triggered) {
    return (
      <Suspense fallback={null}>
        <AccountBlockedPage />
      </Suspense>
    );
  }

  return <>{children}</>;
}
