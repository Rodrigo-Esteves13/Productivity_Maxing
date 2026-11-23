import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, createHmac, randomBytes, randomUUID } from 'crypto';
import { SecurityEventType, type User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { decryptToken, encryptToken } from '../../crypto/token-cipher';
import { isTwoFactorEnabled } from '../../config/app.config';
import { MS_PER_MINUTE, MS_PER_SECOND } from '../../common/time.constants';
import { SecurityLogsService } from '../../security-logs/security-logs.service';
import { AccountGuardService } from './account-guard.service';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from './totp.util';

const ISSUER = 'Productivity Maxing';
const CHALLENGE_TTL_MS = 5 * MS_PER_MINUTE;
const RECOVERY_CODE_COUNT = 10;
// Falhas seguidas permitidas antes de bloquear o utilizador uns minutos
// (além do @Throttle por IP): 6 dígitos = 1M combinações, 5 tentativas por
// janela de 5 min torna adivinhar inviável.
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 5 * MS_PER_MINUTE;
// Tentativas por desafio de login (S-10). Esgotadas, o desafio morre e e
// preciso a password outra vez: sem isto, o bloqueio por conta so travava
// 5 minutos e o mesmo desafio voltava a valer.
export const MAX_CHALLENGE_ATTEMPTS = 5;
// Teto de desafios seguidos em memoria (cada um vive no maximo
// CHALLENGE_TTL_MS). Cheio, esquece os mais antigos.
const MAX_TRACKED_CHALLENGES = 10_000;
// Linha do SecurityLog quando um desafio e queimado. O service nao ve o
// pedido; o controller pode passar ip/userAgent em completeLogin.
const CHALLENGE_LOG_METHOD = 'POST';
const CHALLENGE_LOG_PATH = '/auth/2fa/login';
const CHALLENGE_EXPIRED_MESSAGE = 'Login expired. Please sign in again.';

interface ChallengePayload {
  sub: string;
  purpose: '2fa-login';
  // Id do desafio (claim jti). Tokens antigos sem jti contam pelo userId.
  jti?: string;
  exp?: number;
}

interface ChallengeAttempts {
  count: number;
  expiresAt: number;
}

// Dados do pedido para o SecurityLog (opcionais: o service funciona sem).
export interface TwoFactorClientInfo {
  ip?: string | null;
  userAgent?: string | null;
}

export interface TwoFactorStatus {
  // Flag do backend: false => esconder tudo no frontend.
  available: boolean;
  enabled: boolean;
  recoveryCodesLeft: number;
}

// 2FA TOTP próprio (cobre email+password E OAuth, ao contrário do MFA do
// Supabase, que só protegeria sessões Supabase - a app usa cookies JWT
// próprios). Tudo atrás de TWO_FACTOR_ENABLED (ver config/app.config.ts).
@Injectable()
export class TwoFactorService {
  private readonly failures = new Map<
    string,
    { count: number; lockedUntil: number }
  >();
  // Tentativas por desafio (jti), em memoria desta instancia (ver S-34).
  private readonly challengeAttempts = new Map<string, ChallengeAttempts>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private accountGuard: AccountGuardService,
    private securityLogs: SecurityLogsService,
  ) {}

  isFeatureOn(): boolean {
    return isTwoFactorEnabled();
  }

  /** Esta conta tem de dar um código antes de ter sessão? */
  requiresChallenge(user: Pick<User, 'twoFactorEnabledAt'>): boolean {
    return this.isFeatureOn() && user.twoFactorEnabledAt !== null;
  }

  private assertFeatureOn(): void {
    // 404 (não 403): com a flag desligada a feature "não existe".
    if (!this.isFeatureOn()) throw new NotFoundException();
  }

  // Segredo derivado do JWT_SECRET: o token de desafio nunca pode valer
  // como cookie de sessão (nem ao contrário).
  private challengeSecret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not defined.');
    return createHmac('sha256', base)
      .update('two-factor-login-v1')
      .digest('hex');
  }

  createChallengeToken(user: Pick<User, 'id'>): string {
    const payload: ChallengePayload = { sub: user.id, purpose: '2fa-login' };
    return this.jwtService.sign(payload, {
      secret: this.challengeSecret(),
      expiresIn: CHALLENGE_TTL_MS / MS_PER_SECOND,
      jwtid: randomUUID(),
    });
  }

  // ------------------------------------------------------------- login

  /** Segundo passo do login: token do desafio + código -> o User. */
  async completeLogin(
    token: string,
    code: string,
    client: TwoFactorClientInfo = {},
  ): Promise<User> {
    this.assertFeatureOn();
    let payload: ChallengePayload;
    try {
      payload = this.jwtService.verify<ChallengePayload>(token, {
        secret: this.challengeSecret(),
      });
    } catch {
      throw new UnauthorizedException(CHALLENGE_EXPIRED_MESSAGE);
    }
    if (payload.purpose !== '2fa-login') throw new UnauthorizedException();

    // Conta a tentativa ANTES de qualquer await: pedidos em paralelo com o
    // mesmo desafio nao passam todos pelo teto antes da primeira falha.
    const challengeKey = payload.jti ?? `user:${payload.sub}`;
    if (!this.reserveChallengeAttempt(challengeKey, payload.exp)) {
      throw new UnauthorizedException(CHALLENGE_EXPIRED_MESSAGE);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.twoFactorEnabledAt === null) {
      throw new UnauthorizedException();
    }
    this.accountGuard.assertAccountIsUsable(user);

    const ok = await this.checkCode(user, code);
    if (ok) {
      this.challengeAttempts.delete(challengeKey);
      return user;
    }
    if (this.isChallengeExhausted(challengeKey)) {
      await this.recordChallengeBurned(user.id, client);
      throw new UnauthorizedException(CHALLENGE_EXPIRED_MESSAGE);
    }
    throw new UnauthorizedException('Invalid code.');
  }

  /**
   * Gasta uma tentativa do desafio. false = ja nao ha tentativas (o desafio
   * esta queimado ate expirar).
   */
  private reserveChallengeAttempt(key: string, exp?: number): boolean {
    const now = Date.now();
    const existing = this.challengeAttempts.get(key);
    const entry =
      existing && existing.expiresAt > now
        ? existing
        : {
            count: 0,
            expiresAt: exp ? exp * MS_PER_SECOND : now + CHALLENGE_TTL_MS,
          };
    if (entry.count >= MAX_CHALLENGE_ATTEMPTS) return false;
    entry.count += 1;
    this.challengeAttempts.set(key, entry);
    this.pruneChallenges(now);
    return true;
  }

  private isChallengeExhausted(key: string): boolean {
    const entry = this.challengeAttempts.get(key);
    return entry !== undefined && entry.count >= MAX_CHALLENGE_ATTEMPTS;
  }

  // Mesmo registo que o throttler (RATE_LIMIT_EXCEEDED): sem enum novo no
  // schema. Aparece no export de atividade de seguranca do proprio user.
  private recordChallengeBurned(
    userId: string,
    client: TwoFactorClientInfo,
  ): Promise<void> {
    return this.securityLogs.recordEvent({
      type: SecurityEventType.RATE_LIMIT_EXCEEDED,
      ip: client.ip ?? '',
      method: CHALLENGE_LOG_METHOD,
      path: CHALLENGE_LOG_PATH,
      userAgent: client.userAgent ?? null,
      userId,
    });
  }

  private pruneChallenges(now: number): void {
    if (this.challengeAttempts.size <= MAX_TRACKED_CHALLENGES) return;
    for (const [key, entry] of this.challengeAttempts) {
      if (entry.expiresAt <= now) this.challengeAttempts.delete(key);
    }
    for (const key of this.challengeAttempts.keys()) {
      if (this.challengeAttempts.size <= MAX_TRACKED_CHALLENGES) return;
      this.challengeAttempts.delete(key);
    }
  }

  // ------------------------------------------------------------ gestão

  async getStatus(userId: string): Promise<TwoFactorStatus> {
    if (!this.isFeatureOn()) {
      return { available: false, enabled: false, recoveryCodesLeft: 0 };
    }
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { twoFactorEnabledAt: true, twoFactorRecoveryHashes: true },
    });
    return {
      available: true,
      enabled: user.twoFactorEnabledAt !== null,
      recoveryCodesLeft: user.twoFactorRecoveryHashes.length,
    };
  }

  /** Passo 1: gera segredo (ainda inativo) e devolve o que o QR precisa. */
  async beginSetup(userId: string) {
    this.assertFeatureOn();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.twoFactorEnabledAt !== null) {
      throw new ConflictException('Two-factor authentication is already on.');
    }
    const secret = generateTotpSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: encryptToken(secret),
        twoFactorLastStep: null,
      },
    });
    return {
      secret,
      otpauthUri: buildOtpauthUri({
        secret,
        accountName: user.email,
        issuer: ISSUER,
      }),
    };
  }

  /** Passo 2: o user prova que a app gera códigos certos; ativa e dá os códigos de recuperação (só desta vez). */
  async confirmSetup(userId: string, code: string) {
    this.assertFeatureOn();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.twoFactorEnabledAt !== null) {
      throw new ConflictException('Two-factor authentication is already on.');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Start the setup first.');
    }
    this.assertNotLocked(userId);
    const step = verifyTotp(decryptToken(user.twoFactorSecret), code.trim());
    if (step === null) {
      this.registerFailure(userId);
      throw new BadRequestException(
        'Invalid code. Check the app and try again.',
      );
    }
    this.failures.delete(userId);

    const recoveryCodes = this.generateRecoveryCodes();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabledAt: new Date(),
        twoFactorLastStep: step,
        twoFactorRecoveryHashes: recoveryCodes.map((c) => this.hashRecovery(c)),
      },
    });
    return { recoveryCodes };
  }

  /** Desliga (pede um código válido, da app ou de recuperação). */
  async disable(userId: string, code: string): Promise<void> {
    this.assertFeatureOn();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (user.twoFactorEnabledAt === null) return;
    const ok = await this.checkCode(user, code);
    if (!ok) throw new BadRequestException('Invalid code.');
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorEnabledAt: null,
        twoFactorRecoveryHashes: [],
        twoFactorLastStep: null,
      },
    });
  }

  // ----------------------------------------------------------- interno

  /** Código da app (sem reutilização) ou de recuperação (gasta-se). */
  private async checkCode(user: User, rawCode: string): Promise<boolean> {
    this.assertNotLocked(user.id);
    const code = rawCode.trim();

    if (/^\d{6}$/.test(code) && user.twoFactorSecret) {
      const step = verifyTotp(decryptToken(user.twoFactorSecret), code);
      if (
        step !== null &&
        (user.twoFactorLastStep === null || step > user.twoFactorLastStep)
      ) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { twoFactorLastStep: step },
        });
        this.failures.delete(user.id);
        return true;
      }
    } else {
      const hash = this.hashRecovery(code);
      if (user.twoFactorRecoveryHashes.includes(hash)) {
        // Gasta o código; updateMany com a condição evita usar o mesmo
        // código em dois pedidos em paralelo.
        const remaining = user.twoFactorRecoveryHashes.filter(
          (h) => h !== hash,
        );
        const result = await this.prisma.user.updateMany({
          where: { id: user.id, twoFactorRecoveryHashes: { has: hash } },
          data: { twoFactorRecoveryHashes: remaining },
        });
        if (result.count === 1) {
          this.failures.delete(user.id);
          return true;
        }
      }
    }

    this.registerFailure(user.id);
    return false;
  }

  private generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
      const hex = randomBytes(5).toString('hex');
      return `${hex.slice(0, 5)}-${hex.slice(5)}`;
    });
  }

  private hashRecovery(code: string): string {
    const normalized = code.toLowerCase().replace(/[^a-f0-9]/g, '');
    return createHash('sha256').update(normalized).digest('hex');
  }

  private assertNotLocked(userId: string): void {
    const entry = this.failures.get(userId);
    if (entry && entry.lockedUntil > Date.now()) {
      throw new HttpException(
        'Too many wrong codes. Try again in a few minutes.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private registerFailure(userId: string): void {
    const entry = this.failures.get(userId) ?? { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= MAX_FAILED_ATTEMPTS) {
      entry.count = 0;
      entry.lockedUntil = Date.now() + LOCK_MS;
    }
    this.failures.set(userId, entry);
  }
}
