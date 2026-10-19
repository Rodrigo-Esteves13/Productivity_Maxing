// URL do frontend, usada por CORS (main.ts), redirects de OAuth
// (auth.controller.ts, auth.service.ts, oauth-conflict-redirect.filter.ts)
// e pelos links nos emails (mail.service.ts). Centralizado aqui em vez de
// cada ficheiro repetir o mesmo fallback 'http://localhost:5173' - só
// serve para desenvolvimento local sem FRONTEND_URL definida; em produção
// (Render) a env var está sempre definida, este valor nunca é usado a
// sério lá.
const DEFAULT_LOCAL_FRONTEND_URL = 'http://localhost:5173';

// Valores aceites como "ligado" numa flag de ambiente (tudo o resto, ou
// variavel em falta, e desligado).
const ENV_FLAG_ON_VALUES = new Set(['true', '1', 'yes', 'on']);

function isEnvFlagOn(name: string): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  return raw !== undefined && ENV_FLAG_ON_VALUES.has(raw);
}

export function getFrontendUrl(): string {
  return process.env.FRONTEND_URL ?? DEFAULT_LOCAL_FRONTEND_URL;
}

// Chave da Google Maps Distance Matrix API, usada só por
// ScheduleService.estimateCommute() para calcular commuteMinutes
// automaticamente a partir de homeAddress/campusAddress. Ao contrário dos
// segredos "obrigatórios" (JWT secret, etc.) esta NUNCA faz a app
// arrancar a falhar se estiver em falta - é uma feature opcional que cai
// sempre para o valor manual de commuteMinutes quando não está
// configurada (ver comentário em ScheduleService).
export function getGoogleMapsApiKey(): string | null {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

// Verificação de email obrigatória para contas email+password. DESLIGADA por
// omissão (variável em falta = false): com a flag a false o registo e o login
// comportam-se exatamente como antes e nenhum email de verificação é enviado
// automaticamente. Ligar = pôr REQUIRE_EMAIL_VERIFICATION=true no Render
// (sem deploy de código). Contas OAuth nunca são afetadas (o provider já
// verificou o email) e as contas que já existiam antes da migração ficam
// verificadas por defeito (ver User.emailVerifiedAt no schema.prisma).
export function isEmailVerificationRequired(): boolean {
  return isEnvFlagOn('REQUIRE_EMAIL_VERIFICATION');
}

// 2FA por app autenticadora (TOTP). DESLIGADO por omissão: com a flag a false
// nenhum endpoint de 2FA responde (404), ninguém pode ativar e o login não
// pede código a ninguém. Ligar = TWO_FACTOR_ENABLED=true no Render. Quem
// ativar o 2FA com a flag ligada passa a ter de dar o código em cada login
// (email+password e OAuth).
export function isTwoFactorEnabled(): boolean {
  return isEnvFlagOn('TWO_FACTOR_ENABLED');
}

// Buckets do Supabase Storage e nome do remetente dos emails. Todos tem
// valor por omissao porque so mudam se o projeto Supabase usar outros nomes.
const DEFAULT_AVATAR_BUCKET = 'avatars';
const DEFAULT_NOTEBOOK_BUCKET = 'notebook-photos';
const DEFAULT_NOTEBOOK_ATTACHMENTS_BUCKET = 'notebook-attachments';
const DEFAULT_MAIL_FROM_NAME = 'Productivity Maxing';

export function getAvatarBucket(): string {
  return process.env.SUPABASE_AVATAR_BUCKET ?? DEFAULT_AVATAR_BUCKET;
}

export function getNotebookBucket(): string {
  return process.env.SUPABASE_NOTEBOOK_BUCKET ?? DEFAULT_NOTEBOOK_BUCKET;
}

export function getNotebookAttachmentsBucket(): string {
  return (
    process.env.SUPABASE_NOTEBOOK_ATTACHMENTS_BUCKET ??
    DEFAULT_NOTEBOOK_ATTACHMENTS_BUCKET
  );
}

export function getMailFromName(): string {
  return process.env.SMTP_FROM_NAME ?? DEFAULT_MAIL_FROM_NAME;
}
