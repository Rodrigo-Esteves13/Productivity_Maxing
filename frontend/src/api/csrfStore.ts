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
