import { isSafeRedirectPath } from './safeRedirect';

// Para onde voltar depois de um fluxo OAuth (login/registo com Google,
// Discord, GitHub ou ligar o Google Calendar). O backend redireciona
// sempre para /auth/callback, por isso guardamos o destino antes de sair.
// localStorage e nao sessionStorage: no iOS o login com Google pode
// acabar noutro separador e perdia-se o destino (ex: link de convite
// para uma turma). Expira depressa para um fluxo abandonado nao desviar
// um login de outro dia.
const KEY = 'post-auth-redirect';
const MAX_AGE_MS = 15 * 60 * 1000;

export function rememberPostAuthRedirect(path: string | null | undefined): void {
  try {
    if (path && isSafeRedirectPath(path)) {
      localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Sem storage (modo privado): fica o destino por defeito.
  }
}

/** Le e apaga o destino guardado; null se nao houver ou ja expirou. */
export function takePostAuthRedirect(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    localStorage.removeItem(KEY);
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== 'string' || typeof at !== 'number') return null;
    if (Date.now() - at > MAX_AGE_MS || !isSafeRedirectPath(path)) return null;
    return path;
  } catch {
    return null;
  }
}

/** Pagina atual, para voltar a ela depois de ligar o Google Calendar. */
export function rememberCurrentPage(): void {
  rememberPostAuthRedirect(window.location.pathname + window.location.search);
}
