/* Handlers de Web Push, importados pelo service worker do vite-plugin-pwa
 * (workbox.importScripts: ['push-sw.js'] no vite.config.ts).
 * O servidor envia JSON { title, body, url, tag }. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === 'string' ? data.title.slice(0, 120) : 'Productivity Maxing';
  const options = {
    body: typeof data.body === 'string' ? data.body.slice(0, 300) : '',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    // Só caminhos da própria app: '/x' sim, '//host' (URL externo sem esquema) não.
    data: { url: typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/' },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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
