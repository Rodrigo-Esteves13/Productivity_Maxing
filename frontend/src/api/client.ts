import axios from 'axios';
import { dedupeGets } from './dedupeGets';
import { getCsrfToken, getSessionUserId, setCsrfToken } from './csrfStore';
import { MAINTENANCE_EVENT } from '../lib/maintenanceEvents';
import { ACCOUNT_BLOCKED_EVENT } from '../lib/accountBlockedEvents';
import { API_BASE_URL } from './apiBaseUrl';

// Create the base Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Essencial: sem isto o browser não envia (nem guarda) o cookie
  // HttpOnly de sessão em pedidos cross-origin (frontend e backend em
  // domínios diferentes em produção).
  withCredentials: true,
});

const SAFE_METHODS = new Set(['get', 'head', 'options']);

// GETs iguais ao mesmo tempo partilham um so pedido de rede (ver dedupeGets.ts).
api.defaults.adapter = dedupeGets(axios.getAdapter(api.defaults.adapter), (config) => api.getUri(config));

// Mensagem exata que o CsrfGuard do backend devolve num 403 de CSRF. Serve
// para distinguir "token desatualizado" de um 403 por falta de permissao.
const CSRF_ERROR_MESSAGE = 'Invalid or missing CSRF token.';

// Marca um pedido que ja foi repetido uma vez, para nunca entrar em ciclo.
const RETRIED_AFTER_CSRF_REFRESH = '_retriedAfterCsrfRefresh';

// Varias chamadas podem falhar ao mesmo tempo (ex: duas tabs, ou varios
// pedidos em paralelo): partilham UM so pedido de token novo.
// 'refreshed': token novo, pode repetir. 'failed': sem sessao ou erro.
// 'other-account': a sessao do browser e agora de OUTRO utilizador (login
// noutra tab); o pedido desta tab nao pode ser repetido (F-05).
type CsrfRefreshResult = 'refreshed' | 'failed' | 'other-account';

let pendingCsrfRefresh: Promise<CsrfRefreshResult> | null = null;

function refreshCsrfToken(): Promise<CsrfRefreshResult> {
  if (!pendingCsrfRefresh) {
    pendingCsrfRefresh = api
      .get<{ authenticated: boolean; csrfToken?: string; userId?: string }>('/auth/csrf')
      .then((response): CsrfRefreshResult => {
        const { authenticated, csrfToken: token, userId } = response.data;
        if (!authenticated || !token) return 'failed';
        const tabUserId = getSessionUserId();
        // Backend antigo sem userId: mantem o comportamento anterior.
        if (tabUserId && userId && userId !== tabUserId) return 'other-account';
        setCsrfToken(token);
        return 'refreshed';
      })
      .catch((): CsrfRefreshResult => 'failed')
      .finally(() => {
        pendingCsrfRefresh = null;
      });
  }
  return pendingCsrfRefresh;
}

// SESSAO POR DISPOSITIVO (refresh token)
// O JWT de acesso dura 15 minutos. Quando expira, o backend responde 401 e
// este cliente pede um novo em POST /auth/refresh (o refresh token vive num
// cookie HttpOnly so dessa rota) e repete o pedido original UMA vez.
const REFRESH_ENDPOINT = '/auth/refresh';
const RETRIED_AFTER_SESSION_REFRESH = '_retriedAfterSessionRefresh';
// Web Locks: varias tabs do mesmo browser partilham o cookie do refresh
// token, que roda a cada uso. Sem uma fila entre tabs, duas tabs a renovar
// ao mesmo tempo enviavam o mesmo token e o backend tratava a segunda como
// reutilizacao (e terminava a sessao). Com o lock, a segunda tab so envia
// depois de a primeira ter recebido o cookie novo.
const SESSION_REFRESH_LOCK = 'pmaxing-session-refresh';

export interface SessionRefreshResult {
  csrfToken: string;
  userId: string;
}

// Resultado de um refresh. 'lost': o servidor recusou (401 sem sessao/token
// invalido, 403 da verificacao de origem), a sessao acabou. 'transient': rede,
// 429, 5xx etc.; a sessao pode continuar valida, por isso nao se faz logout.
type RefreshOutcome = { kind: 'ok'; result: SessionRefreshResult } | { kind: 'lost' } | { kind: 'transient' };

// Estados HTTP do /auth/refresh que significam "sessao perdida".
const SESSION_LOST_STATUSES = new Set([401, 403]);

// Pedidos em paralelo da mesma tab partilham UM so refresh (single-flight).
let pendingSessionRefresh: Promise<RefreshOutcome> | null = null;

// Nunca rejeita, para o Web Lock ser sempre libertado.
function postRefresh(): Promise<RefreshOutcome> {
  return api
    .post<SessionRefreshResult>(REFRESH_ENDPOINT)
    .then((response): RefreshOutcome => ({ kind: 'ok', result: response.data }))
    .catch((error: unknown): RefreshOutcome => {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      return status !== undefined && SESSION_LOST_STATUSES.has(status)
        ? { kind: 'lost' }
        : { kind: 'transient' };
    });
}

function sharedRefresh(): Promise<RefreshOutcome> {
  if (!pendingSessionRefresh) {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    const run = locks ? locks.request(SESSION_REFRESH_LOCK, postRefresh) : postRefresh();
    pendingSessionRefresh = run
      .catch((): RefreshOutcome => ({ kind: 'transient' }))
      .finally(() => {
        pendingSessionRefresh = null;
      });
  }
  return pendingSessionRefresh;
}

/**
 * Renova a sessao deste dispositivo. Devolve o token CSRF (e o dono da
 * sessao) ou null se nao foi possivel renovar. Nunca lanca.
 */
export function refreshSession(): Promise<SessionRefreshResult | null> {
  return sharedRefresh().then((outcome) => (outcome.kind === 'ok' ? outcome.result : null));
}

// Antes de qualquer pedido que altera estado, anexa o csrf token guardado em
// memória. O backend compara-o com o valor do cookie csrf_token
// (double-submit cookie) - ver CsrfGuard no backend.
api.interceptors.request.use(
  (config) => {
    const method = config.method?.toLowerCase();
    if (method && !SAFE_METHODS.has(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Endpoints usados só para PERGUNTAR "ainda estou autenticado?" (chamados no
// arranque da app, sem sessão ainda estabelecida). Um 401 aqui é uma resposta
// normal e esperada, não uma sessão que "expirou a meio" - por isso não deve
// disparar um reload. Sem esta exceção, um utilizador sem cookies entra num
// loop infinito: /auth/csrf -> 401 -> reload -> /auth/csrf -> 401 -> reload...
const AUTH_CHECK_ENDPOINTS = ['/auth/csrf', '/auth/me'];

function isAuthCheckRequest(url?: string): boolean {
  if (!url) return false;
  return AUTH_CHECK_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

// Endpoints de LOGIN: um 401 aqui e "credenciais/codigo errados", nao uma
// sessao expirada. A pagina mostra o erro e deixa tentar outra vez. Sem isto,
// um codigo 2FA errado em /login/2fa (pathname != '/login') mandava para
// /login, perdia o token do desafio no fragmento e nunca mostrava "Invalid
// code" (E-03 / F-02).
const LOGIN_ENDPOINTS = new Set(['/auth/login', '/auth/2fa/login', REFRESH_ENDPOINT]);

function isLoginRequest(url?: string): boolean {
  if (!url) return false;
  return LOGIN_ENDPOINTS.has(url.split('?')[0]);
}

// Listens to API responses. If the backend says the token expired (401)
// DURANTE uma ação normal (não durante a verificação de arranque), limpamos
// o estado e mandamos para o login.
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url as string | undefined;

    // Checked first, and unconditionally (even for /auth/csrf and
    // /auth/me) - a maintenance window is a global app state, not
    // something specific to one request, and it should override even the
    // auth-check exemption below.
    if (status === 503 && error.response?.data?.code === 'MAINTENANCE_MODE') {
      window.dispatchEvent(
        new CustomEvent(MAINTENANCE_EVENT, {
          detail: error.response.data.message,
        }),
      );
      return Promise.reject(error);
    }

    // Conta ficou SUSPENDED/BANNED a meio de uma sessão já autenticada
    // (ver JwtStrategy no backend - isto corre em qualquer pedido, não só
    // no login). Ao contrário do 401 genérico abaixo, NÃO limpamos o CSRF
    // nem mandamos para /login - o cookie de sessão continua válido para
    // JwtBlockedAwareGuard, e é exatamente isso que AccountBlockedGate
    // precisa para o próprio ecrã de bloqueio conseguir chamar
    // GET /account-status/me e POST /appeals. (O caso "bloqueado logo no
    // login" é diferente - não passa por aqui, ver Login.tsx.)
    if (status === 401 && error.response?.data?.code === 'ACCOUNT_BLOCKED') {
      window.dispatchEvent(new CustomEvent(ACCOUNT_BLOCKED_EVENT));
      return Promise.reject(error);
    }

    // Token CSRF desatualizado (ex: login ou sessao renovada noutra tab
    // trocou o cookie): pede um token novo e repete o pedido UMA vez. Sem
    // isto, a tab antiga ficava sem conseguir gravar nada ate dar refresh.
    const method = error.config?.method?.toLowerCase();
    const alreadyRetried = Boolean(error.config?.[RETRIED_AFTER_CSRF_REFRESH]);
    if (
      status === 403 &&
      error.response?.data?.message === CSRF_ERROR_MESSAGE &&
      error.config &&
      method &&
      !SAFE_METHODS.has(method) &&
      !alreadyRetried
    ) {
      return refreshCsrfToken().then((result) => {
        if (result === 'other-account') {
          // Esta tab ainda mostra a conta antiga: recarrega para mostrar a
          // conta que esta realmente com sessao, sem gravar nada nela.
          console.warn('Signed in as another account in a different tab. Reloading...');
          window.location.reload();
          return Promise.reject(error);
        }
        if (result !== 'refreshed') return Promise.reject(error);
        error.config[RETRIED_AFTER_CSRF_REFRESH] = true;
        return api.request(error.config);
      });
    }

    // JWT de acesso expirado (ou sessao revogada): tenta renovar UMA vez e
    // repete o pedido. Os endpoints de login/refresh ficam de fora (um 401
    // ai e "credenciais erradas" ou "sem sessao", nao um token expirado).
    const alreadyRefreshed = Boolean(error.config?.[RETRIED_AFTER_SESSION_REFRESH]);
    if (status === 401 && error.config && !isLoginRequest(url) && !alreadyRefreshed) {
      error.config[RETRIED_AFTER_SESSION_REFRESH] = true;
      return sharedRefresh().then((outcome) => {
        if (outcome.kind === 'lost') return handleSessionEnded(error, url);
        // Falha passageira (rede, 429, 5xx): a sessao pode estar valida, entao
        // nao ha logout nem limpeza; o chamador recebe o 401 original.
        if (outcome.kind === 'transient') return Promise.reject(error);
        const result = outcome.result;
        const tabUserId = getSessionUserId();
        if (tabUserId && result.userId && result.userId !== tabUserId) {
          // Mesmo caso do 403 de CSRF acima: o browser tem agora a sessao de
          // outra conta (login noutra tab). Nada e repetido nesta.
          console.warn('Signed in as another account in a different tab. Reloading...');
          window.location.reload();
          return Promise.reject(error);
        }
        setCsrfToken(result.csrfToken);
        return api.request(error.config);
      });
    }

    return handleSessionEnded(error, url);
  },
);

// Sessao terminada de vez (sem refresh possivel): limpa o estado e manda
// para o login, exceto nos pedidos de arranque e de login (ver acima).
function handleSessionEnded(error: { response?: { status?: number } }, url?: string): Promise<never> {
  const status = error.response?.status;
  if (status === 401 && !isAuthCheckRequest(url) && !isLoginRequest(url)) {
    console.warn('Session expired or unauthorized. Logging out...');
    setCsrfToken(null);

    // Evita reload se já lá estamos (ex: várias chamadas em paralelo a
    // falharem ao mesmo tempo).
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }
  return Promise.reject(error);
}

export default api;

// Alguns pedidos deliberadamente NÃO passam pelo axios `api` acima:
// - useHealthCheck: não deve enviar cookies de auth nem disparar o
//   interceptor de logout num 401/erro, é só um ping de "o backend está
//   de pé?".
// - DownloadSetupButton: busca o .exe vanilla como ArrayBuffer, não JSON,
//   e também não deve levar credenciais.
// rawFetch existe para esses casos partilharem pelo menos o mesmo baseURL
// e um timeout, em vez de cada um inventar o seu próprio `fetch(...)` solto
// - ver a documentação de cada chamador para a razão de não usar `api`.
const RAW_FETCH_BASE_URL = API_BASE_URL;

export async function rawFetch(
  path: string,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<Response> {
  const { signal, timeoutMs } = options;

  if (!timeoutMs) {
    return fetch(`${RAW_FETCH_BASE_URL}${path}`, { signal });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  // Se quem chamou também passou um signal próprio, propagamos o abort dele
  // para o nosso controller - assim um cancelamento externo continua a
  // funcionar mesmo com o timeout local a fazer de dono do AbortController.
  signal?.addEventListener('abort', () => controller.abort());

  try {
    return await fetch(`${RAW_FETCH_BASE_URL}${path}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
