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

// Listens to API responses. If the backend says the token expired (401),
// we clear the in-memory session state and force a logout automatically.
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session expired or unauthorized. Logging out...');
      setCsrfToken(null);
      // Redirect to root/login (forces a page refresh to clear app state)
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export default api;
