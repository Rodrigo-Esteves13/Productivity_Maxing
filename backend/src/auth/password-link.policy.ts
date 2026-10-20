/**
 * SCR-002: pode uma credencial de password do Supabase Auth abrir esta conta
 * local? E o inverso do SCR-001 (oauth-merge.policy.ts): ali uma conta por
 * password recebe um login OAuth; aqui uma conta que ja existe (muitas vezes
 * so-OAuth) recebe um login por password.
 *
 * O Supabase Auth aceita registos de qualquer pessoa (inclusive diretamente
 * com a anon key publica do frontend) e o login por password nao prova que
 * quem a criou e dono do email. Por isso:
 * - conta com supabaseAuthId: so a credencial ligada a ela abre a conta;
 * - conta sem supabaseAuthId mas com logins OAuth: nunca teve password nesta
 *   app. O dono adiciona uma em Profile (PATCH /auth/me/password, com sessao
 *   valida), que liga a credencial certa;
 * - conta sem supabaseAuthId e sem OAuth: conta por password antiga, anterior
 *   ao campo supabaseAuthId. Continua a entrar e o campo e preenchido.
 */
export function canPasswordCredentialOpenAccount(
  account: { supabaseAuthId: string | null },
  incomingSupabaseAuthId: string,
  oauthIdentityCount: number,
): boolean {
  if (account.supabaseAuthId) {
    return account.supabaseAuthId === incomingSupabaseAuthId;
  }
  return oauthIdentityCount === 0;
}
