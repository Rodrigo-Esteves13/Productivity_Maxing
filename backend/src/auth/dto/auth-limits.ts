// Limites partilhados pelos DTOs de registo e login (um so sitio).
// 254 = maximo pratico de um endereco de email (RFC 5321).
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_MIN_LENGTH = 8;
// Limite pratico para o hash (scrypt/bcrypt) nao crescer sem necessidade.
export const PASSWORD_MAX_LENGTH = 72;
