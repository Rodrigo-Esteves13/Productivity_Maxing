import { useCallback, useEffect, useState } from 'react';
import { getDeviceSessions, revokeDeviceSession, revokeOtherDeviceSessions } from '../api/userService';
import type { DeviceSession } from '../types/models';

interface UseDeviceSessionsReturn {
  sessions: DeviceSession[];
  isLoading: boolean;
  loadError: boolean;
  // Id da sessao a ser terminada agora (desliga o botao dessa linha).
  revokingId: string | null;
  isRevokingOthers: boolean;
  reload: () => Promise<void>;
  revoke: (id: string) => Promise<boolean>;
  revokeOthers: () => Promise<boolean>;
}

// Dados da pagina Devices: sessoes por dispositivo (GET /auth/sessions) e as
// duas acoes de terminar sessao. A pagina so desenha.
export function useDeviceSessions(): UseDeviceSessionsReturn {
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [isRevokingOthers, setIsRevokingOthers] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setSessions(await getDeviceSessions());
      setLoadError(false);
    } catch (error: unknown) {
      console.error('Failed to load device sessions:', error);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const revoke = useCallback(async (id: string) => {
    setRevokingId(id);
    try {
      await revokeDeviceSession(id);
      setSessions((prev) => prev.filter((session) => session.id !== id));
      return true;
    } catch (error: unknown) {
      console.error('Failed to revoke device session:', error);
      return false;
    } finally {
      setRevokingId(null);
    }
  }, []);

  const revokeOthers = useCallback(async () => {
    setIsRevokingOthers(true);
    try {
      await revokeOtherDeviceSessions();
      setSessions((prev) => prev.filter((session) => session.current));
      return true;
    } catch (error: unknown) {
      console.error('Failed to sign out other devices:', error);
      return false;
    } finally {
      setIsRevokingOthers(false);
    }
  }, []);

  return { sessions, isLoading, loadError, revokingId, isRevokingOthers, reload, revoke, revokeOthers };
}
