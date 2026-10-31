// Limites partilhados pelos DTOs de registo e login (um so sitio).
// 254 = maximo pratico de um endereco de email (RFC 5321).
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
// Limite pratico para o hash (scrypt/bcrypt) nao crescer sem necessidade.
export const PASSWORD_MAX_LENGTH = 72;

// Rate limits das rotas de sessao (por IP, por minuto). O refresh tem folga
// para varias tabs a arrancar ao mesmo tempo; revogar e mais apertado.
// Excecao: o refresh conta por sessao de dispositivo (ver
// refresh-throttle.tracker.ts), com um teto por IP largo o bastante para um
// campus inteiro atras de um NAT, mas que continua a travar abuso.
export const REFRESH_REQUESTS_PER_MINUTE = 30;
export const REFRESH_IP_CEILING_PER_MINUTE = 300;
export const SESSION_REVOKE_REQUESTS_PER_MINUTE = 20;
export const SESSION_REVOKE_OTHERS_REQUESTS_PER_MINUTE = 5;
