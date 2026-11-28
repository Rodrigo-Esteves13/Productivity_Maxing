// Rate limits das rotas do AuthController (pedidos por minuto e por IP, em
// cima do limite global). Um sitio so para rever todos os limites de auth.
// Os limites de refresh e sessoes estao em dto/auth-limits.ts.

// Credenciais: apertados contra forca bruta e envio de emails em massa.
export const REGISTER_REQUESTS_PER_MINUTE = 3;
export const LOGIN_REQUESTS_PER_MINUTE = 5;
export const FORGOT_PASSWORD_REQUESTS_PER_MINUTE = 3;
export const RESET_PASSWORD_REQUESTS_PER_MINUTE = 5;
export const SET_PASSWORD_REQUESTS_PER_MINUTE = 5;

// Links enviados por email (verificacao e "adicionar password").
export const VERIFY_EMAIL_REQUESTS_PER_MINUTE = 10;
export const RESEND_VERIFICATION_REQUESTS_PER_MINUTE = 3;
export const PASSWORD_LINK_REQUESTS_PER_MINUTE = 5;

// 2FA: segundo passo do login e gestao (setup, confirmar, desligar).
export const TWO_FACTOR_LOGIN_REQUESTS_PER_MINUTE = 10;
export const TWO_FACTOR_MANAGE_REQUESTS_PER_MINUTE = 10;

// Criar API keys (listar e revogar so tem o limite global).
export const API_KEY_CREATE_REQUESTS_PER_MINUTE = 5;
