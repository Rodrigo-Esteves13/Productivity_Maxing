// src/hooks/useCalendarStatus.ts
import { useEffect, useState } from 'react';
import { getCalendarStatus } from '../api/calendarService';

// Cache a nível de módulo: o Dashboard pode renderizar dezenas de
// TaskCard/TaskTableRow, cada um usando este hook - sem isto, seria um
// GET /calendar/status por task renderizada. Válido até refreshCalendarStatus()
// ser chamado (ex: depois de voltar do redirect OAuth, ou de ligar/
// desligar o Calendar no Profile).
let cachedStatus: boolean | null = null;
let pendingRequest: Promise<boolean> | null = null;
// True quando o ultimo pedido falhou (o valor mostrado e provisorio).
let lastFetchFailed = false;

// Subscritores = todos os componentes com useCalendarStatus() montados
// neste momento. Sem isto, refreshCalendarStatus() só limpava a cache a
// nível de módulo - um CalendarSyncButton já montado no Dashboard mantinha
// o `connected` antigo no seu próprio useState até remontar (ex: trocar de
// página), o que deixava o botão de sync "aceso" mesmo depois de a pessoa
// desligar a conta no Profile na mesma sessão. Notificar os subscritores é
// o que torna o disconnect/connect instantâneo em toda a app.
const subscribers = new Set<(value: boolean | null) => void>();

function notifySubscribers(value: boolean | null) {
  subscribers.forEach((listener) => listener(value));
}

/** Estado partilhado (pede uma vez, reutiliza a resposta boa). Exportado para os testes. */
export async function fetchStatus(): Promise<boolean> {
  if (cachedStatus !== null) return cachedStatus;
  if (!pendingRequest) {
    pendingRequest = getCalendarStatus()
      .then((res) => {
        cachedStatus = res.connected;
        lastFetchFailed = false;
        notifySubscribers(res.connected);
        return res.connected;
      })
      .catch(() => {
        // Falha temporaria (ex: arranque a frio do Render) NAO fica em cache
        // como "nao ligado": cachedStatus continua null e o proximo mount ou
        // o voltar a app tenta outra vez. Antes ficava false ate um reload
        // (a-09 / F-07). Para ja os componentes tratam-no como nao ligado.
        lastFetchFailed = true;
        notifySubscribers(false);
        return false;
      })
      .finally(() => {
        pendingRequest = null;
      });
  }
  return pendingRequest;
}

/** Chamar depois de qualquer ação que possa ter mudado o estado da ligação
 * (ex: voltar do fluxo /auth/google/link-calendar, ou ligar/desligar no
 * Profile). Invalida a cache E avisa já todos os componentes montados, que
 * voltam a mostrar "a carregar" até o novo GET /calendar/status responder. */
export function refreshCalendarStatus(): void {
  cachedStatus = null;
  notifySubscribers(null);
  fetchStatus();
}

/** Chamar no logout/login: a cache e de UM utilizador. Sem isto, depois de
 * sair e entrar com outra conta (SPA, sem reload) via-se o estado da conta
 * anterior (F-07). Nao faz pedido: o proximo componente montado pede. */
export function resetCalendarStatus(): void {
  cachedStatus = null;
  lastFetchFailed = false;
  notifySubscribers(null);
}

/** null = a carregar, true/false = resultado. Partilhado entre todos os
 * componentes que o chamam - uma só chamada de rede serve todos, e
 * refreshCalendarStatus() atualiza-os todos ao mesmo tempo. */
export function useCalendarStatus(): boolean | null {
  const [connected, setConnected] = useState<boolean | null>(cachedStatus);

  useEffect(() => {
    subscribers.add(setConnected);

    // Se outro componente já disparou o fetch entretanto e a cache está
    // desatualizada em relação ao estado local (ex: este hook montou
    // depois de um refreshCalendarStatus()), alinha já sem esperar por
    // outro efeito.
    if (cachedStatus !== connected) {
      setConnected(cachedStatus);
    }

    fetchStatus().then(setConnected);

    // Se o ultimo pedido falhou, tenta outra vez ao voltar a app.
    const retryIfFailed = () => {
      if (lastFetchFailed && cachedStatus === null && document.visibilityState === 'visible') {
        void fetchStatus();
      }
    };
    document.addEventListener('visibilitychange', retryIfFailed);
    window.addEventListener('focus', retryIfFailed);

    return () => {
      subscribers.delete(setConnected);
      document.removeEventListener('visibilitychange', retryIfFailed);
      window.removeEventListener('focus', retryIfFailed);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return connected;
}
