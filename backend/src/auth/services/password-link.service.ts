import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'crypto';
import type { User } from '@prisma/client';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../../mail/mail.service';
import { getFrontendUrl } from '../../config/app.config';

// Curto: o link so serve para escolher a password, quem o pede volta a
// pedir se expirar (registo ou "esqueci a password").
const LINK_TOKEN_TTL = '30m';
// Mesmo limite do reenvio da verificacao: nao deixa usar o registo para
// encher a caixa de correio de alguem.
const LINK_RESEND_COOLDOWN_MS = 60_000;
const COOLDOWN_PRUNE_THRESHOLD = 500;

interface PasswordLinkPayload {
  sub: string;
  email: string;
  purpose: 'link-password';
  iat?: number;
  exp?: number;
}

export const INVALID_PASSWORD_LINK_CODE = 'INVALID_PASSWORD_LINK' as const;

// "Adicionar password" a uma conta que ainda nao tem (criada so por Google,
// GitHub ou Discord) sem sessao aberta: registo com um email que ja tem
// conta, ou "esqueci a password" numa conta so-OAuth.
//
// O email enviado para a caixa do dono e a prova de que o email e seu
// (SCR-002, ver password-link.policy.ts). A password e escolhida na pagina
// do link, nunca a que veio no pedido de registo: senao um atacante
// disparava o email com a password DELE e bastava a vitima clicar.
//
// O token deixa de valer assim que a conta tem password (supabaseAuthId),
// por isso so funciona uma vez.
@Injectable()
export class PasswordLinkService {
  private readonly logger = new Logger(PasswordLinkService.name);
  private readonly lastSentAt = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  /** Esta conta ainda nao tem password ligada? */
  canLink(user: Pick<User, 'supabaseAuthId'>): boolean {
    return user.supabaseAuthId === null;
  }

  // Segredo derivado do JWT_SECRET com rotulo proprio (mesma regra do
  // EmailVerificationService): este token nunca e aceite como sessao nem
  // como link de verificacao, e vice-versa.
  private signingSecret(): string {
    const base = process.env.JWT_SECRET;
    if (!base) throw new Error('JWT_SECRET is not defined.');
    return createHmac('sha256', base).update('password-link-v1').digest('hex');
  }

  /** Envia o link. Nunca lanca (ver MailService); respeita o cooldown. */
  async send(
    user: Pick<User, 'id' | 'email' | 'supabaseAuthId' | 'status'>,
  ): Promise<void> {
    if (!this.canLink(user) || user.status === UserStatus.BANNED) return;

    const last = this.lastSentAt.get(user.id) ?? 0;
    if (Date.now() - last < LINK_RESEND_COOLDOWN_MS) return;
    this.lastSentAt.set(user.id, Date.now());
    this.pruneCooldowns();

    const payload: PasswordLinkPayload = {
      sub: user.id,
      email: user.email,
      purpose: 'link-password',
    };
    const token = this.jwtService.sign(payload, {
      secret: this.signingSecret(),
      expiresIn: LINK_TOKEN_TTL,
    });
    const link = `${getFrontendUrl()}/set-password?token=${encodeURIComponent(token)}`;
    await this.mailService.sendPasswordLinkEmail(user.email, link);
    this.logger.log(`Link para adicionar password enviado: user ${user.id}`);
  }

  /**
   * Valida o token e devolve a conta, que ainda tem de estar sem password.
   * Quem chama (PasswordAuthService) cria a credencial.
   */
  async consume(token: string): Promise<User> {
    let payload: PasswordLinkPayload;
    try {
      payload = this.jwtService.verify<PasswordLinkPayload>(token, {
        secret: this.signingSecret(),
      });
    } catch {
      throw this.invalidTokenError();
    }
    if (payload.purpose !== 'link-password') throw this.invalidTokenError();

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    // Email tem de ser o mesmo para que foi emitido, e a conta continua sem
    // password (um link ja usado deixa de valer).
    if (!user || user.email !== payload.email || !this.canLink(user)) {
      throw this.invalidTokenError();
    }
    return user;
  }

  private invalidTokenError(): BadRequestException {
    return new BadRequestException({
      code: INVALID_PASSWORD_LINK_CODE,
      message: 'This link is invalid or has expired. Request a new one.',
    });
  }

  private pruneCooldowns(): void {
    if (this.lastSentAt.size < COOLDOWN_PRUNE_THRESHOLD) return;
    const cutoff = Date.now() - LINK_RESEND_COOLDOWN_MS;
    for (const [userId, at] of this.lastSentAt) {
      if (at < cutoff) this.lastSentAt.delete(userId);
    }
  }
}
