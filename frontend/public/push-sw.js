/* Handlers de Web Push, importados pelo service worker do vite-plugin-pwa
 * (workbox.importScripts: ['push-sw.js'] no vite.config.ts).
 * O servidor envia JSON { title, body, url, tag, sentAt }. */

// Hora a mostrar: a do envio (sentAt), nao a da chegada. Um aviso que esteve
// em espera com o telemovel offline nao deve parecer novo. Valores invalidos
// ou no futuro caem para "agora".
function notificationTimestamp(sentAt) {
  const now = Date.now();
  return typeof sentAt === 'number' && Number.isFinite(sentAt) && sentAt > 0 && sentAt <= now ? sentAt : now;
}

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title.slice(0, 120) : 'Productivity Maxing';
  const tag = typeof data.tag === 'string' ? data.tag : undefined;
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 300) : '',
    tag,
    // Com tag, um aviso novo substitui o antigo ainda na bandeja; sem
    // renotify o browser fazia-o sem som nem vibracao (ex: o lembrete das
    // 20:00 a substituir o das 08:00).
    renotify: Boolean(tag),
    // Só caminhos da própria app: '/x' sim, '//host' (URL externo sem esquema) não.
    data: { url: typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/' },
    // icon: logo a cores (imagem grande). badge: so a silhueta (o Android usa
    // apenas a transparencia; com o logo a cores aparecia um quadrado branco).
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    timestamp: notificationTimestamp(data.sentAt),
  };
  // Avisa as janelas abertas para se atualizarem logo (ver useLiveRefresh.ts).
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage({ type: 'pmaxing-push', tag: options.tag })));
  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notifyClients]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Só caminhos da própria app (nunca um URL externo vindo do payload).
  const path = (event.notification.data && event.notification.data.url) || '/';
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// O browser trocou a subscricao (Firefox, ou chave/endpoint renovados): sem
// isto o endpoint antigo dava 410, o backend apagava-o e os lembretes paravam
// com o cartao a dizer "ligado". O SW nao tem o token CSRF para falar com a
// API, por isso volta a subscrever (se o browser nao o fez) e pede as janelas
// abertas que enviem a subscricao (PushSubscriptionSync.tsx). Sem janela
// aberta, a app envia-a da proxima vez que abrir.
self.addEventListener('pushsubscriptionchange', (event) => {
  const oldOptions = event.oldSubscription && event.oldSubscription.options;
  const resubscribe = event.newSubscription
    ? Promise.resolve(event.newSubscription)
    : oldOptions && oldOptions.applicationServerKey
      ? self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: oldOptions.applicationServerKey,
        })
      : Promise.resolve(null);
  event.waitUntil(
    resubscribe
      .catch(() => null)
      .then(() => self.clients.matchAll({ type: 'window', includeUncontrolled: true }))
      .then((clients) => clients.forEach((c) => c.postMessage({ type: 'pmaxing-push-resync' }))),
  );
});
