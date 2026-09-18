import { useCallback, useEffect, useState } from 'react';
import { getBannedIps, banIp, unbanIp } from '../api/bannedIpsService';
import type { BannedIp } from '../types/models';

export function useBannedIps() {
  const [bannedIps, setBannedIps] = useState<BannedIp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getBannedIps();
      setBannedIps(data);
    } catch {
      setError('Could not load banned IPs.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const ban = useCallback(async (ip: string, reason?: string) => {
    setIsSubmitting(true);
    setError('');
    try {
      const created = await banIp(ip, reason);
      setBannedIps((prev) => [created, ...prev]);
      return true;
    } catch (err) {
      // 409 = já banido - a mensagem do backend já diz isso, mostra-la
      // diretamente é mais útil que um "erro genérico" aqui.
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not ban this IP.';
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const unban = useCallback(async (id: string) => {
    setError('');
    try {
      await unbanIp(id);
      setBannedIps((prev) => prev.filter((b) => b.id !== id));
    } catch {
      setError('Could not unban this IP.');
    }
  }, []);

  return { bannedIps, isLoading, error, isSubmitting, ban, unban, refetch: fetchAll };
}
