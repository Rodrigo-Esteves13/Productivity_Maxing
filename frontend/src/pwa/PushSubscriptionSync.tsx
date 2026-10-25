import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { syncPushSubscription } from '../hooks/usePushNotifications';
import { useI18n } from '../i18n/useI18n';

// Mensagem do service worker quando o browser trocou a subscricao
// (pushsubscriptionchange em public/push-sw.js). O SW nao tem o token CSRF,
// por isso quem envia a nova subscricao ao backend e a app.
const RESYNC_MESSAGE = 'pmaxing-push-resync';

// Montado uma vez (AppRouter). Mantem a subscricao push deste dispositivo
// ligada a conta com sessao e na lingua atual: ao abrir a app, ao trocar de
// conta ou de lingua, e quando o service worker avisa que a subscricao mudou.
// Nao desenha nada e nunca pede permissao (isso so acontece num clique).
export default function PushSubscriptionSync() {
  const { isAuthenticated, user } = useAuth();
  const { lang } = useI18n();
  const userId = isAuthenticated ? user?.id : undefined;
  const [resyncCount, setResyncCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    // Depois de um aviso do SW envia sempre, mesmo com o mesmo endpoint.
    syncPushSubscription(userId, lang, resyncCount > 0).catch((err: unknown) => {
      console.error('Falha ao sincronizar a subscricao push:', err);
    });
  }, [userId, lang, resyncCount]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: unknown } | null;
      if (data && data.type === RESYNC_MESSAGE) setResyncCount((n) => n + 1);
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  return null;
}
