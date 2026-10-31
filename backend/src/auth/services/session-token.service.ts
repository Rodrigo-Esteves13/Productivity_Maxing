import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { Provider, SessionRevokeReason, User } from '@prisma/client';
import { SessionStateService } from '../../account-status/session-state.service';
import {
  JwtPayload,
  LinkStatePayload,
} from '../interfaces/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_TOKEN_TTL_SECONDS } from '../session.constants';
import { isSessionCurrent } from '../session-version.util';
import { UserSessionsService } from './user-sessions.service';

export type AccessSessionStatus = 'live' | 'stale' | 'revoked';

// Tudo o que e emitir/verificar tokens: JWT de sessao, token CSRF e o state
// assinado do fluxo "ligar conta".
@Injectable()
export class SessionTokenService {
  constructor(
    private jwtService: JwtService,
    private sessionState: SessionStateService,
    private userSessions: UserSessionsService,
    private prisma: PrismaService,
  ) {}

  /**
   * Verifica um JWT vindo do cookie de sessão sem lançar excepção - usado
   * pelo GET /auth/csrf, que precisa de responder 200 tanto para "estás
   * autenticado" como para "não estás", em vez de dar 401 (isso faz o
   * DevTools mostrar um erro vermelho toda vez que a app arranca sem
   * sessão, o que é um estado normal, não um erro).
   *
   * ignoreExpiration: so para o logout, que precisa de saber QUE sessao
   * terminar mesmo com o JWT de acesso (15 min) ja expirado. A assinatura
   * continua a ser verificada.
   */
  verifyAccessTokenCookie(
    token: string | undefined,
    options: { ignoreExpiration?: boolean } = {},
  ): JwtPayload | null {
    if (!token) return null;
    try {
      return this.jwtService.verify<JwtPayload>(token, {
        ignoreExpiration: options.ignoreExpiration ?? false,
      });
    } catch {
      return null;
    }
  }

  /** JWT de acesso curto, ligado a sessao de dispositivo `sessionId`. */
  issueJwt(user: User, sessionId: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tv: user.tokenVersion,
      sid: sessionId,
    };
    return this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  /**
   * Interruptor global: sobe a tokenVersion (todos os JWT emitidos antes
   * deixam de valer) e revoga as sessoes de dispositivo, menos
   * `keepSessionId` (a do pedido atual, que continua com a versao nova).
   * Devolve o utilizador atualizado para se poder emitir um token novo.
   */
  async revokeAllSessions(
    userId: string,
    keepSessionId?: string,
    reason: SessionRevokeReason = SessionRevokeReason.GLOBAL_SIGNOUT,
  ): Promise<User> {
    // Uma so transacao: com as tres escritas separadas, um refresh do
    // dispositivo a manter que caisse entre a subida da tokenVersion e o
    // confirmTokenVersion via a versao da sessao desatualizada e revogava
    // esse mesmo dispositivo. Assim o refresh ve tudo antes ou tudo depois.
    const fresh = await this.prisma.$transaction(async (tx) => {
      const updated = await this.sessionState.bumpTokenVersion(userId, tx);
      await this.userSessions.revokeAllExcept(
        userId,
        reason,
        keepSessionId,
        new Date(),
        tx,
      );
      if (keepSessionId) {
        await this.userSessions.confirmTokenVersion(
          userId,
          keepSessionId,
          updated.tokenVersion,
          tx,
        );
      }
      return updated;
    });
    // Depois do commit: as invalidacoes feitas dentro da transacao correram
    // antes dele, e um pedido entretanto podia ter voltado a guardar em cache
    // a versao antiga ou uma sessao ainda ativa.
    this.sessionState.invalidate(userId);
    this.sessionState.invalidateDeviceSessionsOfUser(userId);
    return fresh;
  }

  /**
   * Estado real da sessao de um JWT de acesso ja verificado (assinatura e
   * validade), com as mesmas regras do JwtStrategy: 'revoked' se a conta ja
   * nao existe ou a sessao de dispositivo (`sid`) foi revogada/expirou;
   * 'stale' se a tokenVersion ja nao e a atual (troca de password, "terminar
   * sessao em todo o lado"); 'live' caso contrario. Um JWT antigo sem `sid`
   * vale so pela versao, como no JwtStrategy.
   */
  async getAccessSessionStatus(
    payload: JwtPayload,
  ): Promise<AccessSessionStatus> {
    const state = await this.sessionState.get(payload.sub);
    if (!state) return 'revoked';
    if (
      payload.sid &&
      !(await this.sessionState.isDeviceSessionActive(payload.sid, payload.sub))
    ) {
      return 'revoked';
    }
    return isSessionCurrent(payload.tv, state.tokenVersion) ? 'live' : 'stale';
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

  /**
   * Valida o state E que o browser que volta do provider tem a sessao do
   * mesmo utilizador que o gerou. Sem a segunda parte, o state sozinho era
   * transferivel: quem gerasse um state para a PROPRIA conta podia mandar o
   * URL de autorizacao a outra pessoa, e a conta Google/GitHub/Discord dela
   * (incluindo o token do Calendar) ficava ligada a conta de quem enviou
   * (CSRF no "ligar conta", RFC 6749 10.12). O cookie de sessao e SameSite
   * Lax, por isso chega neste redirect GET de topo vindo do provider.
   *
   * A sessao tem de estar viva, nao so bem assinada: um JWT ainda dentro dos
   * 15 minutos mas de um dispositivo revogado (`sid`) ou anterior a um
   * "terminar sessao em todo o lado" (`tv`) nao liga contas.
   */
  async consumeLinkState(
    state: string,
    provider: Provider,
    sessionCookie: string | undefined,
  ): Promise<string> {
    try {
      const payload = this.jwtService.verify<LinkStatePayload>(state);
      if (payload.purpose !== 'link' || payload.provider !== provider) {
        throw new UnauthorizedException(
          'Invalid OAuth state for this provider.',
        );
      }
      const session = this.verifyAccessTokenCookie(sessionCookie);
      if (
        !session ||
        'purpose' in session ||
        session.sub !== payload.sub ||
        (await this.getAccessSessionStatus(session)) !== 'live'
      ) {
        throw new UnauthorizedException(
          'Start the link from your own signed-in session.',
        );
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state.');
    }
  }
}
