import axios from 'axios';
import { getCsrfToken, setCsrfToken } from './csrfStore';
import { MAINTENANCE_EVENT } from '../lib/maintenanceEvents';

// Create the base Axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  // Essencial: sem isto o browser não envia (nem guarda) o cookie
  // HttpOnly de sessão em pedidos cross-origin (frontend e backend em
  // domínios diferentes em produção).
  withCredentials: true,
});

const SAFE_METHODS = new Set(['get', 'head', 'options']);

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
  }
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
        new CustomEvent(MAINTENANCE_EVENT, { detail: error.response.data.message }),
      );
      return Promise.reject(error);
    }

    if (status === 401 && !isAuthCheckRequest(url)) {
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
);

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
const RAW_FETCH_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    return await fetch(`${RAW_FETCH_BASE_URL}${path}`, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}