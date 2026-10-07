import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Provider, User } from '@prisma/client';
import { SessionStateService } from '../../account-status/session-state.service';
import {
  JwtPayload,
  LinkStatePayload,
} from '../interfaces/jwt-payload.interface';

// Tudo o que e emitir/verificar tokens: JWT de sessao, token CSRF e o state
// assinado do fluxo "ligar conta".
@Injectable()
export class SessionTokenService {
  constructor(
    private jwtService: JwtService,
    private sessionState: SessionStateService,
  ) {}

  /**
   * Verifica um JWT vindo do cookie de sessão sem lançar excepção - usado
   * pelo GET /auth/csrf, que precisa de responder 200 tanto para "estás
   * autenticado" como para "não estás", em vez de dar 401 (isso faz o
   * DevTools mostrar um erro vermelho toda vez que a app arranca sem
   * sessão, o que é um estado normal, não um erro).
   */
  verifyAccessTokenCookie(token: string | undefined): JwtPayload | null {
    if (!token) return null;
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      return null;
    }
  }

  issueJwt(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
  }

  /**
   * Invalida todas as sessoes do utilizador (logout, troca de password).
   * Devolve o utilizador atualizado para se poder emitir um token novo.
   */
  revokeAllSessions(userId: string): Promise<User> {
    return this.sessionState.bumpTokenVersion(userId);
  }

  /**
   * Token aleatório para o padrão "double submit cookie" do CsrfGuard.
   * Não tem de ser assinado nem verificável - só precisa de ser
   * imprevisível e de bater certo entre o cookie e o header no mesmo pedido.
   */
  generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * State assinado e de curta duração, enviado ao provider OAuth no fluxo de
   * "ligar conta". Faz o papel de proteção CSRF: só quem possui um JWT válido
   * do próprio backend consegue gerar um state aceite no callback, e o state
   * expira em 10 minutos.
   */
  createLinkState(userId: string, provider: Provider): string {
    const payload: LinkStatePayload = {
      sub: userId,
      purpose: 'link',
      provider,
    };
    return this.jwtService.sign(payload, { expiresIn: '10m' });
  }

  consumeLinkState(state: string, provider: Provider): string {
    try {
      const payload = this.jwtService.verify<LinkStatePayload>(state);
      if (payload.purpose !== 'link' || payload.provider !== provider) {
        throw new UnauthorizedException(
          'Invalid OAuth state for this provider.',
        );
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state.');
    }
  }
}
