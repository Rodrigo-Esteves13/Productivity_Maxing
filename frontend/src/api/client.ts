import axios from 'axios';
import { getCsrfToken, setCsrfToken } from './csrfStore';

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