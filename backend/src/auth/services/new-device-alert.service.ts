import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { PushService } from '../../push/push.service';
import { resolveMailLanguage } from '../../mail/mail-messages';
import { DEVICES_PATH } from '../../common/app-links.util';
import { getFrontendUrl } from '../../config/app.config';
import {
  describeClient,
  UNKNOWN_CLIENT_LABEL,
} from '../client-description.util';
import { maskIp, truncateUserAgent } from '../session-client.util';
import type { SessionClientInfo } from './user-sessions.service';

// Quantas sessoes anteriores se comparam. Uma conta normal tem meia duzia (as
// expiradas/revogadas apagam-se pelo cron); o teto so evita ler sem fim.
const MAX_PREVIOUS_SESSIONS = 500;
const PAIR_SEPARATOR = '|';

export interface NewDeviceSession {
  userId: string;
  sessionId: string;
  client: SessionClientInfo;
  at: Date;
}

function pairKey(
  userAgent: string | null | undefined,
  ipMasked: string | null | undefined,
): string {
  const { browser, os } = describeClient(userAgent);
  return [browser, os, ipMasked ?? ''].join(PAIR_SEPARATOR);
}

/**
 * Alerta "novo dispositivo": quando nasce uma sessao (login real, nunca um
 * refresh) e o par (navegador + sistema, IP mascarado) nunca apareceu nas
 * sessoes anteriores da conta (revogadas e expiradas ainda guardadas
 * incluidas), avisa por email e push. A primeira sessao de uma conta nunca
 * avisa. Nunca lanca: quem chama corre isto em segundo plano.
 */
@Injectable()
export class NewDeviceAlertService {
  private readonly logger = new Logger(NewDeviceAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly push: PushService,
  ) {}

  /** true se o aviso foi disparado. */
  async checkAndNotify(session: NewDeviceSession): Promise<boolean> {
    const userAgent = truncateUserAgent(session.client.userAgent);
    const ipMasked = maskIp(session.client.ip);
    const { browser, os } = describeClient(userAgent);
    // Sem nada reconhecivel nao ha o que mostrar no aviso.
    if (
      browser === UNKNOWN_CLIENT_LABEL &&
      os === UNKNOWN_CLIENT_LABEL &&
      !ipMasked
    ) {
      return false;
    }

    const previous = await this.prisma.userSession.findMany({
      where: { userId: session.userId, id: { not: session.sessionId } },
      select: { userAgent: true, ipMasked: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_PREVIOUS_SESSIONS,
    });
    if (previous.length === 0) return false;

    const current = pairKey(userAgent, ipMasked);
    if (
      previous.some((row) => pairKey(row.userAgent, row.ipMasked) === current)
    ) {
      return false;
    }

    await this.notify(session, { browser, os, ipMasked });
    return true;
  }

  private async notify(
    session: NewDeviceSession,
    device: { browser: string; os: string; ipMasked: string | null },
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        email: true,
        // Lingua da app (a das subscricoes push), como nos outros emails.
        pushSubscriptions: {
          select: { lang: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
    if (!user) return;
    const lang = resolveMailLanguage(user.pushSubscriptions[0]?.lang);
    const devicesLink = `${getFrontendUrl()}${DEVICES_PATH}`;
    const label = [
      `${device.browser} / ${device.os}`,
      ...(device.ipMasked ? [device.ipMasked] : []),
    ].join(', ');

    // allSettled: um canal a falhar nunca impede o outro.
    const results = await Promise.allSettled([
      this.mail.sendNewDeviceLoginEmail(
        user.email,
        { ...device, at: session.at },
        devicesLink,
        lang,
      ),
      this.push.notifyUser(session.userId, 'newDeviceLogin', {
        title: label,
        url: DEVICES_PATH,
      }),
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `New device alert ${index === 0 ? 'email' : 'push'} failed: ${
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason)
          }`,
        );
      }
    });
  }
}
