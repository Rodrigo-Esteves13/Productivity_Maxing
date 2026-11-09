import { Injectable } from '@nestjs/common';
import { SecurityEventType, SessionRevokeReason } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { isTwoFactorEnabled } from '../../config/app.config';

// Tetos do export "Download my security activity" (pagina Devices). Uma
// conta normal tem meia duzia de sessoes (as expiradas e as revogadas ha mais
// de 7 dias sao apagadas pelo cron); isto so limita um caso patologico.
export const SECURITY_EXPORT_MAX_SESSIONS = 200;
export const SECURITY_EXPORT_MAX_EVENTS = 200;

// Que linhas do SecurityLog contam como atividade de seguranca do proprio
// utilizador. Os tipos ADMIN_* ficam de fora: ai o userId e o do admin que
// fez a moderacao, nao um evento sobre a conta.
export const SECURITY_EXPORT_EVENT_TYPES: readonly SecurityEventType[] = [
  SecurityEventType.REFRESH_TOKEN_REUSE,
  SecurityEventType.RATE_LIMIT_EXCEEDED,
];

export interface SecurityActivitySession {
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: SessionRevokeReason | null;
  userAgent: string | null;
  // Ja vem mascarado da BD (IPv4 /24, IPv6 /48), igual ao que a pagina
  // Devices mostra. Nunca o IP completo.
  ipMasked: string | null;
  current: boolean;
}

export interface SecurityActivityEvent {
  type: SecurityEventType;
  firstAt: Date;
  lastAt: Date;
  count: number;
}

export interface SecurityActivityExport {
  generatedAt: Date;
  accountCreatedAt: Date | null;
  // null com o 2FA desligado no backend (TWO_FACTOR_ENABLED) ou nao ativo.
  twoFactorEnabledAt: Date | null;
  sessions: SecurityActivitySession[];
  events: SecurityActivityEvent[];
  sessionsTruncated: boolean;
  eventsTruncated: boolean;
}

/**
 * Export pessoal do que a BD ja guarda sobre a seguranca da conta: sessoes
 * por dispositivo (incluindo revogadas ainda guardadas), eventos do
 * SecurityLog do proprio utilizador e a data de ativacao do 2FA.
 *
 * Regras: todas as queries filtram por userId; os select sao explicitos e
 * nunca leem hashes, tokens, segredos nem o IP completo do SecurityLog (a
 * pagina Devices nao o mostra, por isso o export tambem nao).
 */
@Injectable()
export class SecurityActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async exportForUser(
    userId: string,
    currentSessionId: string | undefined,
    now: Date = new Date(),
  ): Promise<SecurityActivityExport> {
    const [user, sessionRows, eventRows] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { createdAt: true, twoFactorEnabledAt: true },
      }),
      this.prisma.userSession.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          lastSeenAt: true,
          expiresAt: true,
          revokedAt: true,
          revokedReason: true,
          userAgent: true,
          ipMasked: true,
        },
        orderBy: { createdAt: 'desc' },
        // +1 so para saber se ficou alguma de fora.
        take: SECURITY_EXPORT_MAX_SESSIONS + 1,
      }),
      this.prisma.securityLog.findMany({
        where: { userId, type: { in: [...SECURITY_EXPORT_EVENT_TYPES] } },
        select: {
          type: true,
          createdAt: true,
          updatedAt: true,
          count: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: SECURITY_EXPORT_MAX_EVENTS + 1,
      }),
    ]);

    // Campos copiados um a um (e nao `...row`): mesmo que o select mude, uma
    // coluna nova (hash, token) nunca passa para o export sem querer.
    const sessions = sessionRows
      .slice(0, SECURITY_EXPORT_MAX_SESSIONS)
      .map((row) => ({
        createdAt: row.createdAt,
        lastSeenAt: row.lastSeenAt,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
        revokedReason: row.revokedReason,
        userAgent: row.userAgent,
        ipMasked: row.ipMasked,
        current: currentSessionId !== undefined && row.id === currentSessionId,
      }));
    const events = eventRows
      .slice(0, SECURITY_EXPORT_MAX_EVENTS)
      .map((row) => ({
        type: row.type,
        firstAt: row.createdAt,
        lastAt: row.updatedAt,
        count: row.count,
      }));

    return {
      generatedAt: now,
      accountCreatedAt: user?.createdAt ?? null,
      twoFactorEnabledAt: isTwoFactorEnabled()
        ? (user?.twoFactorEnabledAt ?? null)
        : null,
      sessions,
      events,
      sessionsTruncated: sessionRows.length > SECURITY_EXPORT_MAX_SESSIONS,
      eventsTruncated: eventRows.length > SECURITY_EXPORT_MAX_EVENTS,
    };
  }
}
