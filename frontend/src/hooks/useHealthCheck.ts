import { useEffect, useState } from 'react';

export type HealthStatus = 'checking' | 'ok' | 'down';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const POLL_INTERVAL_MS = 30000;
const REQUEST_TIMEOUT_MS = 5000;

// Faz ping ao endpoint /health do backend de X em X segundos.
// Nota: usamos fetch "cru" (não o axios do api/client.ts) porque não queremos
// enviar o token de auth nem despoletar o interceptor de logout em caso de 401/erro.
export default function useHealthCheck(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking');

  useEffect(() => {
    let isMounted = true;

    const checkHealth = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${apiUrl}/health`, { signal: controller.signal });
        if (isMounted) setStatus(response.ok ? 'ok' : 'down');
      } catch {
        if (isMounted) setStatus('down');
      } finally {
        clearTimeout(timeoutId);
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
