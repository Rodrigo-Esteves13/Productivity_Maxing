import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { readDailyDigestEnabled } from '../../hooks/useDailyDigestPref';
import { consumeSlot, isSlotUsed } from '../../lib/dailyDigest';
import { todayKey } from '../../lib/dateKey';
import DailyDigestCard from './DailyDigestCard';

const DASHBOARD_PATH = '/dashboard';

// A preferencia le-se a cada render (muda no Profile sem remontar isto).
// Montado uma vez no AppRouter (precisa do Router). So existe no Dashboard,
// com sessao iniciada, a preferencia ligada e a vaga de hoje por gastar. Ao
// sair do Dashboard depois de mostrado, fica fechado ate amanha.
export default function DailyDigestHost() {
  const { isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [now] = useState(() => new Date());
  const [shown, setShown] = useState(false);
  const [closed, setClosed] = useState(false);

  const onDashboard = pathname === DASHBOARD_PATH;
  const day = todayKey(now);

  useEffect(() => {
    if (shown && !onDashboard) setClosed(true);
  }, [shown, onDashboard]);

  const handleShown = useCallback(() => {
    consumeSlot(day);
    setShown(true);
  }, [day]);
  const handleDismiss = useCallback(() => setClosed(true), []);

  if (!isAuthenticated || !readDailyDigestEnabled() || !onDashboard || closed) return null;
  if (!shown && isSlotUsed(day)) return null;
  return <DailyDigestCard now={now} onShown={handleShown} onDismiss={handleDismiss} />;
}
