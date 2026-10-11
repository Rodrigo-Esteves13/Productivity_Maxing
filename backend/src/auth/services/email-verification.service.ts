import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import type { User } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import {
  getFrontendUrl,
  isEmailVerificationRequired,
} from '../../config/app.config';
import { SupabaseClientsService } from './supabase-clients.service';

const VERIFY_TOKEN_TTL = '24h';
// Não reenvia para o mesmo utilizador mais do que 1x por minuto (evita usar
// o endpoint para encher a caixa de correio de alguém).
const RESEND_COOLDOWN_MS = 60_000;

interface VerifyEmailPayload {
  sub: string;
  email: string;
  purpose: 'verify-email';
  iat?: number;
  exp?: number;
}

export const EMAIL_NOT_VERIFIED_CODE = 'EMAIL_NOT_VERIFIED' as const;

// Verificação de email das contas email+password.
//
// Fica TUDO desligado enquanto REQUIRE_EMAIL_VERIFICATION não for true (ver
// config/app.config.ts): nenhum email é enviado no registo e o login não
// bloqueia ninguém. Os endpoints /auth/verify-email e
// /auth/resend-verification existem sempre mas só são chamados pelo
// frontend quando o backend responde que a verificação é exigida.
//
// A fonte de verdade é User.emailVerifiedAt (nossa BD). Ao confirmar,
// também marcamos o email como confirmado no Supabase Auth (email_confirm),
// para o painel do Supabase refletir o estado real.
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private clients: SupabaseClientsService,
  ) {}

  isRequired(): boolean {
    return isEmailVerificationRequired();
  }

  /** Esta conta tem de verificar o email antes de entrar? */
  needsVerification(user: Pick<User, 'emailVerifiedAt'>): boolean {
    return this.isRequired() && user.emailVerifiedAt === null;
  }

  // Segredo DERIVADO do JWT_SECRET (HMAC com um rótulo fixo), nunca o próprio
  // JWT_SECRET: o token de verificação não pode ser aceite como cookie de
  // sessão (e vice-versa) só por partilharem a chave de assinatura.
  private signingSecret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not defined.');
    return createHmac('sha256', base).update('email-verification-v1').digest('hex');
  }

  private createToken(user: Pick<User, 'id' | 'email'>): string {
    const payload: VerifyEmailPayload = {
      sub: user.id,
      email: user.email,
      purpose: 'verify-email',
    };
    return this.jwtService.sign(payload, {
      secret: this.signingSecret(),
      expiresIn: VERIFY_TOKEN_TTL,
    });
  }

  /** Envia o email com o link. Nunca lança (ver MailService). */
  async sendVerificationEmail(
    user: Pick<User, 'id' | 'email'>,
  ): Promise<boolean> {
    const token = this.createToken(user);
    const link = `${getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    this.lastSentAt.set(user.id, Date.now());
    return this.mailService.sendEmailVerificationEmail(user.email, link);
  }

  /**
   * Reenvio a pedido (botão "Resend" no ecrã de login/registo). Resposta
   * sempre igual no controller, exista a conta ou não. Só reenvia para
   * contas email+password (supabaseAuthId) ainda por verificar.
   */
  async resend(email: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (
      !user ||
      user.emailVerifiedAt !== null ||
      !user.supabaseAuthId ||
      user.status === UserStatus.BANNED
    ) {
      return;
    }

    const last = this.lastSentAt.get(user.id) ?? 0;
    if (Date.now() - last < RESEND_COOLDOWN_MS) return;

    await this.sendVerificationEmail(user);
    this.pruneCooldowns();
  }

  /**
   * Valida o token do link e marca o email como verificado. Idempotente:
   * clicar duas vezes no mesmo link (ou abrir o link já verificado) devolve
   * sucesso em vez de erro.
   */
  async verify(token: string): Promise<{ email: string }> {
    let payload: VerifyEmailPayload;
    try {
      payload = this.jwtService.verify<VerifyEmailPayload>(token, {
        secret: this.signingSecret(),
      });
    } catch {
      throw this.invalidTokenError();
    }
    if (payload.purpose !== 'verify-email') throw this.invalidTokenError();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    // O email tem de ser o mesmo para que foi emitido (se o email da conta
    // mudasse, links antigos deixavam de valer).
    if (!user || user.email !== payload.email) throw this.invalidTokenError();

    if (user.emailVerifiedAt === null) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
      this.logger.log(`Email verificado: user ${user.id}`);
    }

    // Espelha no Supabase Auth. Best-effort: a nossa BD já é a fonte de
    // verdade, uma falha aqui nunca deve desfazer a verificação.
    if (user.supabaseAuthId) {
      try {
        const { error } = await this.clients.admin.auth.admin.updateUserById(
          user.supabaseAuthId,
          { email_confirm: true },
        );
        if (error) {
          this.logger.warn(
            `Supabase email_confirm falhou para ${user.id}: ${error.message}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Supabase email_confirm falhou para ${user.id}: ${String(err)}`,
        );
      }
    }

    return { email: user.email };
  }

  private invalidTokenError(): BadRequestException {
    return new BadRequestException({
      code: 'INVALID_VERIFICATION_TOKEN',
      message:
        'This verification link is invalid or has expired. Request a new one.',
    });
  }

  private pruneCooldowns(): void {
    if (this.lastSentAt.size < 500) return;
    const cutoff = Date.now() - RESEND_COOLDOWN_MS;
    for (const [userId, at] of this.lastSentAt) {
      if (at < cutoff) this.lastSentAt.delete(userId);
    }
  }
}
