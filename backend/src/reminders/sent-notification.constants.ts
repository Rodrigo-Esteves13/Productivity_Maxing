// Tipos de aviso periodico guardados em SentNotification.kind. O valor e
// persistido: nunca renomear um valor existente (os marcadores antigos
// deixavam de contar e o aviso saia outra vez).
export const SENT_NOTIFICATION_KIND = {
  DUE_TODAY_DIGEST: 'due-today-digest',
  STREAK_RISK: 'streak-risk',
  MONEY_REMINDER: 'money-reminder',
  BUDGET_TOTAL_WARN: 'budget-total-warn',
  BUDGET_TOTAL_OVER: 'budget-total-over',
  BUDGET_LEISURE_WARN: 'budget-leisure-warn',
  BUDGET_LEISURE_OVER: 'budget-leisure-over',
  ABSENCE_LIMIT: 'absence-limit',
  MONTHLY_DIGEST: 'monthly-digest',
} as const;

export type SentNotificationKind =
  (typeof SENT_NOTIFICATION_KIND)[keyof typeof SENT_NOTIFICATION_KIND];

// Marcadores mais antigos do que isto sao apagados na limpeza do
// RemindersService.run. Tem de passar o periodo mais longo (um mes) com folga.
export const SENT_NOTIFICATION_RETENTION_DAYS = 62;

// Codigos do Prisma tratados no claim: P2002 = ja existe o marcador (outro
// envio ganhou); P2003 = o user foi apagado entretanto (nada a enviar).
export const PRISMA_UNIQUE_VIOLATION = 'P2002';
export const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
