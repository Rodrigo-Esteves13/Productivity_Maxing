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

async function fetchStatus(): Promise<boolean> {
  if (cachedStatus !== null) return cachedStatus;
  if (!pendingRequest) {
    pendingRequest = getCalendarStatus()
      .then((res) => {
        cachedStatus = res.connected;
        notifySubscribers(res.connected);
        return res.connected;
      })
      .catch(() => {
        cachedStatus = false;
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

    return () => {
      subscribers.delete(setConnected);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return connected;
}
