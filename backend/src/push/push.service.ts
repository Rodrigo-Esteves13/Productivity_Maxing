import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { SubscribePushDto } from './dto/subscribe-push.dto';
import { buildPushText, type PushMessageKey } from './push-messages';
import {
  MS_PER_DAY,
  MS_PER_MINUTE,
  MS_PER_SECOND,
} from '../common/time.constants';
import { MEDICATION_REMINDER_WINDOW_MINUTES } from '../wellbeing/wellbeing.constants';

const MAX_SUBSCRIPTIONS_PER_USER = 10;

// Avisos de pedidos (acesso a uma nota, ler notas de um amigo): no maximo um
// por par e por dia. Sem isto, cancelar e voltar a pedir notificava o dono em
// ciclo. Em memoria (so ha uma instancia no Render); um restart apenas
// permite um aviso a mais. Tamanho limitado para nunca crescer sem fim.
export const REQUEST_NOTIFY_COOLDOWN_MS = MS_PER_DAY;
const MAX_COOLDOWN_ENTRIES = 10_000;

// O servidor faz POST ao `endpoint` que o cliente envia: sem esta lista, um
// user mau registava http://rede-interna/... e usava o backend como proxy
// (SSRF). Só se aceitam os serviços de push reais dos browsers.
const ALLOWED_PUSH_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase();
    return ALLOWED_PUSH_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    );
  } catch {
    return false;
  }
}

export interface PushNotifyOptions {
  name?: string;
  title?: string;
  /** Quantas mais (avisos agrupados, ex: "e mais 2 prazos"). */
  count?: number;
  /** Caminho dentro da app a abrir ao clicar (sempre relativo). */
  url: string;
}

// Quanto tempo o serviço de push guarda um aviso para um telemóvel offline.
// Por omissão um dia; um lembrete de medicação velho de horas podia levar a
// uma toma fora de horas, por isso expira com a janela do lembrete.
export const DEFAULT_PUSH_TTL_SECONDS = MS_PER_DAY / MS_PER_SECOND;
const MEDICATION_PUSH_TTL_SECONDS =
  (MEDICATION_REMINDER_WINDOW_MINUTES * MS_PER_MINUTE) / MS_PER_SECOND;
const PUSH_TTL_SECONDS: Partial<Record<PushMessageKey, number>> = {
  medicationDue: MEDICATION_PUSH_TTL_SECONDS,
  medicationsDue: MEDICATION_PUSH_TTL_SECONDS,
};

export function pushTtlSeconds(key: PushMessageKey): number {
  return PUSH_TTL_SECONDS[key] ?? DEFAULT_PUSH_TTL_SECONDS;
}

// Caminho relativo da app: começa por uma só barra.
const APP_PATH_PATTERN = /^\/(?!\/)/;

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private enabled = false;
  private readonly lastNotifiedAt = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT; // ex: mailto:tu@dominio.pt
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn(
        'VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT em falta - push desligado.',
      );
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.enabled = true;
  }

  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.enabled ? process.env.VAPID_PUBLIC_KEY! : null };
  }

  /**
   * Para avisar no ecra (ex: lembretes de medicacao ligados sem nenhum
   * dispositivo com push, que de outra forma nunca chegavam). So conta os
   * dispositivos do proprio utilizador.
   */
  async getStatus(userId: string): Promise<PushStatus> {
    if (!this.enabled) return { configured: false, devices: 0 };
    const devices = await this.prisma.pushSubscription.count({
      where: { userId },
    });
    return { configured: true, devices };
  }

  async subscribe(userId: string, dto: SubscribePushDto) {
    if (!isAllowedPushEndpoint(dto.endpoint)) {
      throw new BadRequestException('Unsupported push service.');
    }
    const existing = await this.prisma.pushSubscription.findUnique({
      where: { endpoint: dto.endpoint },
    });
    // O mesmo browser pode mudar de conta: a subscrição passa para o user atual.
    if (!existing) {
      const count = await this.prisma.pushSubscription.count({
        where: { userId },
      });
      if (count >= MAX_SUBSCRIPTIONS_PER_USER) {
        throw new BadRequestException('Too many devices subscribed.');
      }
    }
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        lang: dto.lang ?? 'en',
      },
      update: {
        userId,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        lang: dto.lang ?? 'en',
      },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { subscribed: false };
  }

  /**
   * Envia um aviso a TODOS os dispositivos do user. Nunca lança: um aviso
   * falhado não pode partir o pedido que o originou (aprovar, pedir acesso...).
   * Devolve em quantos dispositivos o envio foi aceite (0 com push desligado).
   */
  async notifyUser(
    userId: string,
    key: PushMessageKey,
    options: PushNotifyOptions,
  ): Promise<number> {
    if (!this.enabled) return 0;
    try {
      return (await this.deliverToUser(userId, key, options)).delivered;
    } catch (error) {
      this.logger.warn(`notifyUser falhou: ${(error as Error).message}`);
      return 0;
    }
  }

  /**
   * Como notifyUser, mas no maximo uma vez por `dedupeKey` dentro de
   * `cooldownMs` (ex: o mesmo pedido cancelado e refeito). Devolve 0 quando
   * suprimido.
   */
  async notifyUserOnce(
    userId: string,
    key: PushMessageKey,
    options: PushNotifyOptions,
    dedupeKey: string,
    cooldownMs = REQUEST_NOTIFY_COOLDOWN_MS,
    now = Date.now(),
  ): Promise<number> {
    const last = this.lastNotifiedAt.get(dedupeKey);
    if (last !== undefined && now - last < cooldownMs) return 0;
    this.rememberNotified(dedupeKey, now, cooldownMs);
    return this.notifyUser(userId, key, options);
  }

  private rememberNotified(dedupeKey: string, now: number, cooldownMs: number) {
    if (this.lastNotifiedAt.size >= MAX_COOLDOWN_ENTRIES) {
      for (const [k, at] of this.lastNotifiedAt) {
        if (now - at >= cooldownMs) this.lastNotifiedAt.delete(k);
      }
      // Ainda cheio: descarta o mais antigo (Map guarda ordem de insercao).
      if (this.lastNotifiedAt.size >= MAX_COOLDOWN_ENTRIES) {
        const oldest = this.lastNotifiedAt.keys().next();
        if (!oldest.done) this.lastNotifiedAt.delete(oldest.value);
      }
    }
    this.lastNotifiedAt.delete(dedupeKey);
    this.lastNotifiedAt.set(dedupeKey, now);
  }

  /**
   * Aviso de teste para diagnosticar "não recebi nada": diz quantos
   * dispositivos o user tem registados e em quantos o envio foi aceite.
   */
  async sendTest(userId: string): Promise<PushTestResult> {
    if (!this.enabled) return { configured: false, devices: 0, delivered: 0 };
    const { devices, delivered } = await this.deliverToUser(
      userId,
      'pushTest',
      {
        url: '/profile',
      },
    );
    return { configured: true, devices, delivered };
  }

  private async deliverToUser(
    userId: string,
    key: PushMessageKey,
    options: PushNotifyOptions,
  ): Promise<{ devices: number; delivered: number }> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subs.length === 0) {
      this.logger.log(
        `Push "${key}": o utilizador não tem dispositivos registados.`,
      );
    }
    const results = await Promise.all(
      subs.map(async (sub) => {
        const text = buildPushText(sub.lang, key, options);
        const payload = JSON.stringify({
          title: text.title,
          body: text.body,
          // Só caminhos da app ('/x'); '//host' seria um URL externo.
          url: APP_PATH_PATTERN.test(options.url) ? options.url : '/',
          tag: key,
          // Hora do envio: o SW mostra-a em vez da hora a que chegou.
          sentAt: Date.now(),
        });
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload,
            { TTL: pushTtlSeconds(key), urgency: 'high' },
          );
          return true;
        } catch (error) {
          const status = (error as { statusCode?: number }).statusCode;
          // 404/410 = subscrição morta (browser desinstalado/permissão retirada).
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription
              .deleteMany({ where: { id: sub.id } })
              .catch(() => undefined);
          } else {
            this.logger.warn(`Push falhou (${status ?? 'sem estado'}).`);
          }
          return false;
        }
      }),
    );
    return { devices: subs.length, delivered: results.filter(Boolean).length };
  }
}

export interface PushStatus {
  configured: boolean;
  devices: number;
}

export interface PushTestResult {
  configured: boolean;
  devices: number;
  delivered: number;
}
