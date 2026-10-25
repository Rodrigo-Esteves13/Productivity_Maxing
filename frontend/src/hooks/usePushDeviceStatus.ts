import { useCallback, useEffect, useState } from 'react';
import { getPushStatus, type PushStatus } from '../api/pushService';

/**
 * Quantos dispositivos desta conta recebem push (GET /push/status). Serve
 * para avisar quando algo depende de push (lembretes de medicacao) e nenhum
 * aviso pode chegar. `null` enquanto carrega ou se o pedido falhou: na duvida
 * nao se mostra aviso nenhum.
 */
export function usePushDeviceStatus(enabled: boolean) {
  const [status, setStatus] = useState<PushStatus | null>(null);

  const reload = useCallback(async () => {
    try {
      setStatus(await getPushStatus());
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);

  return { status, reload };
}
