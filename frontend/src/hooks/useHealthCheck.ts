import { useEffect, useState } from 'react';
import { rawFetch } from '../api/client';

export type HealthStatus = 'checking' | 'ok' | 'down';

const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

// Faz ping ao endpoint /health do backend de X em X segundos.
// Nota: usamos rawFetch (não o axios `api` do api/client.ts) porque não
// queremos enviar o token de auth nem despoletar o interceptor de logout
// em caso de 401/erro - ver o comentário junto de rawFetch para a razão de
// isto ainda passar por um helper partilhado em vez de um fetch() solto.
export default function useHealthCheck(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      try {
        const response = await rawFetch('/health', { timeoutMs: REQUEST_TIMEOUT_MS });
        if (isMounted) setStatus(response.ok ? 'ok' : 'down');
      } catch {
        if (isMounted) setStatus('down');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return status;
}
