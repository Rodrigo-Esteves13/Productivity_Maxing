// Guarda o csrf token só em memória (nunca em localStorage/sessionStorage),
// exatamente para não ficar exposto a um XSS - é a mesma razão pela qual o
// JWT deixou de ir para o localStorage. Perde-se ao dar refresh à página,
// mas o AuthProvider já trata disso (pede um novo em /auth/csrf no arranque).

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export function getCsrfToken(): string | null {
  return csrfToken;
}

// Id do utilizador que ESTA tab mostra (posto pelo AuthProvider). O cliente
// HTTP compara-o com o dono da sessao antes de repetir um pedido apos um 403
// de CSRF: se outra tab entrou com outra conta, o pedido desta tab nao pode
// ser gravado nessa conta (F-05).
let sessionUserId: string | null = null;

export function setSessionUserId(id: string | null) {
  sessionUserId = id;
}

export function getSessionUserId(): string | null {
  return sessionUserId;
}
