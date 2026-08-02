import { useEffect, useState, type ReactNode } from 'react';
import MaintenancePage from './MaintenancePage';
import { MAINTENANCE_EVENT } from '../../lib/maintenanceEvents';

interface MaintenanceGateProps {
  children: ReactNode;
}

// Wraps the whole app (see App.tsx) - once any API call reports
// MAINTENANCE_MODE, every route behind it stops making sense (they'd all
// just 503 too), so this replaces the entire tree rather than trying to
// patch up one page at a time. Stays in maintenance mode for the rest of
// this page load once triggered - "Try again" (MaintenancePage's button)
// does a full reload, which re-checks the backend from scratch.
export default function MaintenanceGate({ children }: MaintenanceGateProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleMaintenance = (e: Event) => {
      const detail = (e as CustomEvent<string | undefined>).detail;
      setMessage(detail ?? '');
    };
    window.addEventListener(MAINTENANCE_EVENT, handleMaintenance);
    return () => window.removeEventListener(MAINTENANCE_EVENT, handleMaintenance);
  }, []);

  if (message !== null) {
    return <MaintenancePage message={message || undefined} />;
  }

  return <>{children}</>;
}
