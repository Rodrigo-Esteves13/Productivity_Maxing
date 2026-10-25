import { useCallback, useEffect, useState } from 'react';
import { getPushPublicKey, subscribePush, unsubscribePush } from '../api/pushService';
import { useI18n } from '../i18n/useI18n';

export type PushState = 'loading' | 'unsupported' | 'unconfigured' | 'blocked' | 'off' | 'on';

// A chave VAPID vem em base64url; o browser quer bytes.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

const WORKER_TIMEOUT_MS = 8000;

// `serviceWorker.ready` nunca resolve se nao houver service worker registado
// (ex: `npm run dev`, onde o SW esta desligado): sem limite, o botao ficava
// preso em "a processar" para sempre e sem erro na consola.
async function getActiveRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('service-worker-timeout')), WORKER_TIMEOUT_MS);
  });
  try {
    return await Promise.race([navigator.serviceWorker.ready, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export type PushError = 'generic' | 'noWorker';

// Ultima subscricao enviada ao backend neste separador (conta|endpoint|lingua).
// Evita repetir o POST a cada ecra que monta o hook.
let lastSyncedKey: string | null = null;

const syncKey = (userId: string, endpoint: string, lang: string) => `${userId}|${endpoint}|${lang}`;

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return (await registration?.pushManager.getSubscription()) ?? null;
}

/**
 * Volta a enviar ao backend a subscricao que o browser ja tem. A linha no
 * backend passa a ser desta conta (o mesmo browser pode ter estado noutra
 * conta), fica com a lingua atual da app e e recriada se o backend a apagou
 * (404/410 passageiro, troca de chave do browser, pushsubscriptionchange).
 * Sem isto o cartao dizia "ligado" e nenhum aviso chegava.
 */
export async function syncPushSubscription(userId: string, lang: string, force = false): Promise<void> {
  if (!isSupported() || Notification.permission !== 'granted') return;
  const subscription = await currentSubscription();
  if (!subscription) return;
  const key = syncKey(userId, subscription.endpoint, lang);
  if (!force && key === lastSyncedKey) return;
  await subscribePush(subscription.toJSON(), lang);
  lastSyncedKey = key;
}

/**
 * Ao terminar sessao: este dispositivo deixa de receber os avisos desta
 * conta (titulos de prazos, nomes de amigos, lembretes). Remove a linha no
 * backend (precisa da sessao, por isso corre antes do logout) e cancela a
 * subscricao no browser mesmo que o pedido falhe: o endpoint morto da 410 e
 * o backend apaga-o no proximo envio. Devolve se havia subscricao.
 */
export async function unsubscribeThisDevice(): Promise<boolean> {
  lastSyncedKey = null;
  if (!isSupported()) return false;
  const subscription = await currentSubscription();
  if (!subscription) return false;
  try {
    await unsubscribePush(subscription.endpoint);
  } finally {
    await subscription.unsubscribe();
  }
  return true;
}

export function usePushNotifications() {
  const { lang } = useI18n();
  const [state, setState] = useState<PushState>('loading');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<PushError | null>(null);

  const refresh = useCallback(async () => {
    if (!isSupported()) return setState('unsupported');
    try {
      const key = await getPushPublicKey();
      if (!key) return setState('unconfigured');
      if (Notification.permission === 'denied') return setState('blocked');
      const registration = await navigator.serviceWorker.getRegistration();
      const existing = await registration?.pushManager.getSubscription();
      setState(existing && Notification.permission === 'granted' ? 'on' : 'off');
    } catch {
      setState('off');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Devolve o estado final (null se falhou): o pedido a entrada na app
  // precisa de saber se fecha ou mostra o erro.
  const enable = useCallback(async (): Promise<PushState | null> => {
    setIsBusy(true);
    setError(null);
    const finish = (next: PushState) => {
      setState(next);
      return next;
    };
    try {
      const key = await getPushPublicKey();
      if (!key) return finish('unconfigured');
      // O pedido de permissão TEM de nascer de um clique do utilizador.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return finish(permission === 'denied' ? 'blocked' : 'off');
      const registration = await getActiveRegistration();
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));
      await subscribePush(subscription.toJSON(), lang);
      lastSyncedKey = null;
      return finish('on');
    } catch (err) {
      console.error('Falha ao ativar notificacoes:', err);
      setError(err instanceof Error && err.message === 'service-worker-timeout' ? 'noWorker' : 'generic');
      return null;
    } finally {
      setIsBusy(false);
    }
  }, [lang]);

  const disable = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      lastSyncedKey = null;
      setState('off');
    } catch (err) {
      console.error('Falha ao desativar notificacoes:', err);
      setError('generic');
    } finally {
      setIsBusy(false);
    }
  }, []);

  return { state, isBusy, error, enable, disable };
}
