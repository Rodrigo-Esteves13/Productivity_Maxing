/* Handlers de Web Push, importados pelo service worker do vite-plugin-pwa
 * (workbox.importScripts: ['push-sw-config.js', 'push-sw.js'] no vite.config.ts).
 * O servidor envia JSON { title, body, url, tag, sentAt } e, nos lembretes de
 * medicacao de UMA toma, { actions, actionToken } para o botao "Tomei". */

// Botao "Tomei" dos lembretes de medicacao. O SW nao tem o cookie de sessao
// nem o token CSRF: a credencial e o actionToken do proprio push, assinado
// pelo backend e que so marca aquela toma (POST /wellbeing/medications/dose-action).
const DOSE_ACTION = 'taken';
const DOSE_ACTION_PATH = '/wellbeing/medications/dose-action';
const DOSE_ACTION_TAGS = ['medicationDue', 'medicationsDue', 'medicationFollowUp'];
const DOSE_ACTION_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const MAX_DOSE_ACTION_TOKEN_LENGTH = 1024;
const MAX_ACTION_TITLE_LENGTH = 40;

// URL base da API, escrito no build em push-sw-config.js (VITE_API_URL, ver
// vite.config.ts). Nunca vem do push. So https (ou http em localhost); sem um
// valor valido o botao nem aparece.
function apiBaseUrl() {
  const raw = self.PMAXING_API_BASE_URL;
  if (typeof raw !== 'string' || raw === '') return null;
  try {
    const url = new URL(raw);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

// Botao "Tomei" deste push, ou null. So nos avisos de medicacao, com um token
// com forma de JWT e um rotulo vindo do servidor (ja traduzido).
function doseActionFrom(data, tag) {
  if (!DOSE_ACTION_TAGS.includes(tag) || !apiBaseUrl()) return null;
  const token = data.actionToken;
  if (typeof token !== 'string' || token.length > MAX_DOSE_ACTION_TOKEN_LENGTH || !DOSE_ACTION_TOKEN_PATTERN.test(token)) {
    return null;
  }
  const action = Array.isArray(data.actions)
    ? data.actions.find((a) => a && a.action === DOSE_ACTION && typeof a.title === 'string' && a.title !== '')
    : null;
  return action ? { token, title: action.title.slice(0, MAX_ACTION_TITLE_LENGTH) } : null;
}

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
  const doseAction = doseActionFrom(data, tag);
  if (doseAction) {
    options.actions = [{ action: DOSE_ACTION, title: doseAction.title }];
    options.data.actionToken = doseAction.token;
  }
  // Avisa as janelas abertas para se atualizarem logo (ver useLiveRefresh.ts).
  const notifyClients = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clients) => clients.forEach((c) => c.postMessage({ type: 'pmaxing-push', tag: options.tag })));
  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notifyClients]));
});

function openApp(path) {
  const target = new URL(path, self.location.origin).href;
  return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
        client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow(target);
  });
}

// Marca a toma com o token do push. Sem cookies (credentials: 'omit'): o
// pedido vale so pelo token. true se o backend confirmou (ou ja estava tomada).
function takeDose(token) {
  const base = apiBaseUrl();
  if (!base) return Promise.resolve(false);
  return fetch(base + DOSE_ACTION_PATH, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then((res) => res.ok)
    .catch(() => false);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  // Só caminhos da própria app (nunca um URL externo vindo do payload).
  const path = data.url || '/';
  if (event.action === DOSE_ACTION && typeof data.actionToken === 'string') {
    // Sucesso: a notificacao fecha e as janelas abertas atualizam a lista.
    // Falha (sem rede, token expirado): abre a app para marcar a mao.
    event.waitUntil(
      takeDose(data.actionToken).then((ok) =>
        ok
          ? self.clients
              .matchAll({ type: 'window', includeUncontrolled: true })
              .then((clients) => clients.forEach((c) => c.postMessage({ type: 'pmaxing-push', tag: 'medicationTaken' })))
          : openApp(path),
      ),
    );
    return;
  }
  event.waitUntil(openApp(path));
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
