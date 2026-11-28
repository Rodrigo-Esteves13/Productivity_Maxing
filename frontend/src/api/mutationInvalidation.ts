import type { AxiosAdapter } from 'axios';
import { forgetInFlightGets } from './dedupeGets';
import { invalidateQueries } from './queryCache';

declare module 'axios' {
  interface AxiosRequestConfig {
    // 'patched': o servico corrige ele proprio o "ultimo conhecido" da cache
    // depois de a escrita correr bem (ver catalogCache.ts). A cache normal e
    // invalidada na mesma.
    cacheEffect?: 'patched';
  }
}

// Escritas que de certeza nao mudam tasks, areas, metadados nem o cartao
// "Hoje" (agenda, turnos, plano de estudo). Tudo o que nao esta aqui
// invalida a cache inteira: uma rota nova fica segura por omissao, no
// maximo custa um pedido a mais.
const CACHE_NEUTRAL_PREFIXES: readonly string[] = [
  '/telemetry',
  '/feedback',
  '/push',
  '/finance',
  '/wellbeing',
  '/social',
  '/friend-code-requests',
  '/admin/social',
  '/admin/banned-ips',
  '/admin/security-logs',
  '/notebook',
  '/flashcards',
  '/quizzes',
  '/pads',
  '/notes',
  '/appeals',
  '/area-ratings',
  '/streak-freezes',
  '/agent/config',
  '/auth/refresh',
  '/auth/api-keys',
  '/auth/sessions',
  '/auth/2fa/setup',
  '/auth/2fa/confirm',
  '/auth/2fa/disable',
  '/auth/me/avatar',
  '/auth/me/password',
  '/auth/resend-verification',
  '/auth/forgot-password',
];

// Pulsos da sessao de estudo ativa (a cada minuto e a cada distracao): so
// mexem na propria sessao.
const CACHE_NEUTRAL_PATTERNS: readonly RegExp[] = [/^\/study-sessions\/[^/]+\/(heartbeat|distraction)$/];

const SAFE_METHODS = new Set(['get', 'head', 'options']);

// Caminho do pedido sem query, sem origem e com "/" no inicio.
export function mutationPath(url: string | undefined): string {
  if (!url) return '/';
  let path = url;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      return path;
    }
  }
  path = path.split(/[?#]/)[0];
  return path.startsWith('/') ? path : `/${path}`;
}

export function isCacheNeutralMutation(path: string): boolean {
  return (
    CACHE_NEUTRAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ||
    CACHE_NEUTRAL_PATTERNS.some((pattern) => pattern.test(path))
  );
}

/**
 * Envolve o adapter: cada escrita (POST, PATCH, PUT, DELETE) que nao e
 * neutra invalida a cache de GETs no inicio (ninguem le dados de antes da
 * escrita enquanto ela corre) e outra vez no fim, com sucesso ou erro (um
 * pedido iniciado durante a escrita nunca fica guardado). O aviso aos
 * outros separadores sai so no fim, quando a escrita ja esta gravada.
 * Qualquer escrita, neutra ou nao, solta tambem no inicio e no fim os GETs em
 * voo (dedupeGets.ts): mesmo uma rota neutra muda os seus proprios GETs.
 */
export function invalidateOnWrite(network: AxiosAdapter): AxiosAdapter {
  return (config) => {
    const method = (config.method ?? 'get').toLowerCase();
    if (SAFE_METHODS.has(method)) return network(config);
    forgetInFlightGets();
    if (isCacheNeutralMutation(mutationPath(config.url))) return network(config).finally(forgetInFlightGets);
    const keepLastKnown = config.cacheEffect === 'patched';
    invalidateQueries(undefined, { keepLastKnown, broadcast: false });
    return network(config).then(
      (response) => {
        forgetInFlightGets();
        invalidateQueries(undefined, { keepLastKnown });
        return response;
      },
      (error: unknown) => {
        forgetInFlightGets();
        // Sem resposta fiavel, a correcao do servico nao corre: esquece tudo.
        invalidateQueries(undefined, { keepLastKnown: false });
        throw error;
      },
    );
  };
}
