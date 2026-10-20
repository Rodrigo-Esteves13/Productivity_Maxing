import { useCallback } from 'react';
import { useAuth } from '../../context/useAuth';
import { getMyAccountStatus } from '../../api/userService';
import { ACCOUNT_BLOCKED_EVENT } from '../../lib/accountBlockedEvents';
import { useVisibleInterval } from '../../hooks/useVisibleInterval';

// Mesma ordem de grandeza que useHealthCheck.ts (30s), sem precisar de ser
// mais agressivo que isso.
const STATUS_POLL_INTERVAL_MS = 30000;

// O ACCOUNT_BLOCKED_EVENT (ver AccountBlockedGate) so dispara quando OUTRO
// pedido calha de ser rejeitado - um separador parado (sem navegar, sem
// fetches em fundo) podia ficar muito tempo sem dar por um ban/suspensao.
// Este poll apanha isso diretamente.
//
// Vive dentro do AuthProvider de proposito: so corre com sessao. Antes
// corria tambem sem sessao, e o 401 do /account-status/me passava pelo
// interceptor do api/client.ts, que manda para /login - um visitante numa
// pagina publica era levado para o login ao fim de 30s. So corre com o
// separador visivel (ver useVisibleInterval).
export default function AccountStatusWatcher(): null {
  const { isAuthenticated } = useAuth();

  const check = useCallback(() => {
    getMyAccountStatus()
      .then((status) => {
        if (status.status !== 'ACTIVE') window.dispatchEvent(new CustomEvent(ACCOUNT_BLOCKED_EVENT));
      })
      .catch(() => {
        // Erro de rede passageiro: o proximo tick tenta outra vez.
      });
  }, []);

  useVisibleInterval(check, STATUS_POLL_INTERVAL_MS, { enabled: isAuthenticated });
  return null;
}
