import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SessionRevokeReason, type User } from '@prisma/client';
import { AuthService } from '../auth.service';
import {
  UserSessionsService,
  type SessionClientInfo,
} from './user-sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { isSessionCurrent } from '../session-version.util';
import { isWellFormedCsrfToken } from '../csrf-token.util';
import { getFrontendUrl } from '../../config/app.config';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  OAUTH_LOGIN_STATE_COOKIE,
  REFRESH_TOKEN_COOKIE,
  accessTokenCookieOptions,
  csrfCookieOptions,
  clearCookieOptions,
  clearRefreshCookieOptions,
  refreshTokenCookieOptions,
} from '../cookie.config';

// URL do frontend para onde se redireciona depois do callback OAuth.
// Ajustar em produção para o domínio real (Netlify).
const FRONTEND_URL = getFrontendUrl();

type CookieJar = Record<string, string | undefined>;

// Resposta de GET /auth/csrf (ver resumeSession).
export type SessionCsrfState =
  | { authenticated: false; refreshable?: boolean }
  | { authenticated: true; csrfToken: string; userId: string };

// Dados do pedido guardados (reduzidos) na sessao do dispositivo.
function clientInfo(req: Request): SessionClientInfo {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path,
  };
}

function cookiesOf(req: Request): CookieJar {
  return (req.cookies ?? {}) as CookieJar;
}

/**
 * Sessao do browser por cookie: cria, continua, roda e termina a sessao do
 * dispositivo (UserSession) e emite/limpa os cookies do JWT de acesso, do
 * refresh token e do CSRF. O AuthController so orquestra; as regras de
 * sessao vivem aqui para se testarem sem o controller.
 */
@Injectable()
export class SessionCookieService {
  // Mesmo nome de logger que o controller usava: as linhas de log nao mudam.
  private readonly logger = new Logger('RequestLog');

  constructor(
    private readonly authService: AuthService,
    private readonly userSessions: UserSessionsService,
    private readonly prisma: PrismaService,
  ) {}

  // Define os cookies de sessão (JWT + refresh + CSRF) e devolve o csrfToken
  // no corpo, para os fluxos de login/register que respondem diretamente ao
  // frontend (o frontend não precisa de ler cookies à mão, só guarda o valor
  // devolvido aqui em memória).
  async establishSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<{ csrfToken: string }> {
    await this.startDeviceSession(user, req, res);
    const csrfToken = this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());

    this.logger.log(
      `Login (email/password) - user: id=${user.id}, role=${user.role}`,
    );

    return { csrfToken };
  }

  // Mesma coisa, mas para os callbacks OAuth, que respondem com um redirect
  // em vez de um JSON body - por isso o csrfToken não vai aqui, o frontend
  // pede-o à parte em GET /auth/csrf assim que aterra em /auth/callback.
  async issueSessionAndRedirect(req: Request, res: Response) {
    const user = req.user as User;

    // Conta com 2FA: sem cookie de sessão ainda. O token do desafio vai no
    // FRAGMENTO do URL (#), que o browser nunca envia a servidores nem fica
    // em logs de pedidos; o frontend pede o código e conclui em /auth/2fa/login.
    if (this.authService.requiresTwoFactor(user)) {
      res.clearCookie(OAUTH_LOGIN_STATE_COOKIE, clearCookieOptions());
      const challenge = this.authService.createTwoFactorChallenge(user);
      return res.redirect(
        `${FRONTEND_URL}/login/2fa#token=${encodeURIComponent(challenge)}`,
      );
    }

    // Regresso de um "ligar conta" (Google/GitHub/Discord, Calendar) num
    // browser que ja tem sessao deste utilizador: continua a mesma sessao
    // de dispositivo (so um JWT novo), em vez de criar outra e deixar a
    // antiga orfa na lista de dispositivos.
    if (!(await this.continueDeviceSession(user, req, res))) {
      await this.startDeviceSession(user, req, res);
    }
    // Já não precisamos do state anti-CSRF do login OAuth depois de
    // consumido - limpa-o para não ficar pendurado nem ser reutilizável.
    // Mesmos atributos com que foi criado (Secure, Path=/, sem Domain): para
    // um cookie __Host- o browser ignora uma remocao que nao cumpra o prefixo.
    res.clearCookie(OAUTH_LOGIN_STATE_COOKIE, clearCookieOptions());

    this.logger.log(`Login (OAuth) - user: id=${user.id}, role=${user.role}`);

    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }

  // POST /auth/refresh (a origem ja foi validada no controller). Troca o
  // refresh token do cookie por um novo e emite um JWT de acesso novo.
  async refreshSession(
    req: Request,
    res: Response,
  ): Promise<{ csrfToken: string; userId: string }> {
    const cookies = cookiesOf(req);
    // Numa rejeicao NAO se apagam os cookies: se dois pedidos do mesmo
    // browser colidirem, o Set-Cookie de "apagar" do perdedor podia chegar
    // depois do token novo do vencedor e apaga-lo. O frontend trata o 401
    // como sessao terminada e o logout limpa tudo.
    const rotated = await this.userSessions.rotate(
      cookies[REFRESH_TOKEN_COOKIE],
      clientInfo(req),
    );
    this.setDeviceSessionCookies(res, rotated.user, rotated);

    // Reutiliza o token CSRF que o browser ja tem (outras tabs guardam-no em
    // memoria, ver GET /auth/csrf); so cria um se nao existir.
    const csrfToken = this.reuseOrIssueCsrf(cookies, res);
    return { csrfToken, userId: rotated.user.id };
  }

  // GET /auth/csrf: estado da sessao deste browser. Nunca lanca 401 ("nao
  // estas autenticado" e um estado normal aqui, ver o controller).
  async resumeSession(req: Request, res: Response): Promise<SessionCsrfState> {
    const cookies = cookiesOf(req);
    const accessToken = cookies[ACCESS_TOKEN_COOKIE];
    const payload = this.authService.verifyAccessTokenCookie(accessToken);

    if (!payload || 'purpose' in payload) {
      // refreshable: o JWT de acesso so expirou (assinatura valida, com
      // `sid`). O frontend tenta POST /auth/refresh so neste caso, para um
      // visitante sem sessao nao fazer um pedido extra a cada arranque.
      const expired = payload
        ? null
        : this.authService.verifyAccessTokenCookie(accessToken, {
            ignoreExpiration: true,
          });
      return { authenticated: false, refreshable: !!expired?.sid };
    }

    // Assinatura e validade nao chegam: a sessao do dispositivo (`sid`) pode
    // ter sido revogada, ou a tokenVersion ter subido, com o JWT ainda dentro
    // dos 15 minutos (o JwtStrategy ja o recusa). refreshable: so se o
    // dispositivo continua ativo e so a versao esta atrasada (ex: resposta
    // perdida de um "terminar as outras sessoes"); o refresh decide pela BD.
    if (payload.sid) {
      const status = await this.authService.getAccessSessionStatus(payload);
      if (status !== 'live') {
        return { authenticated: false, refreshable: status === 'stale' };
      }
    }

    // JWT antigo (de antes das sessoes por dispositivo, sem `sid`, ate 7
    // dias): passa a ter uma sessao com refresh token, sem novo login. So
    // acontece uma vez por browser (o cookie e trocado por um JWT com `sid`).
    // Pode sair daqui 7 dias depois do deploy, quando ja nao houver tokens
    // destes validos.
    if (!payload.sid) {
      const upgraded = await this.upgradeLegacySession(
        payload.sub,
        payload.tv,
        req,
        res,
      );
      if (!upgraded) return { authenticated: false };
    }

    // Reutiliza o token que o browser ja tem, em vez de gerar um novo de
    // cada vez. O cookie csrf_token e UM so para todas as tabs, mas cada tab
    // guarda o seu token em memoria: se abrir uma tab nova trocasse o
    // cookie, as tabs antigas ficavam com um token que ja nao bate certo e
    // todos os pedidos que alteram estado (incluindo o heartbeat da sessao
    // de Focus) davam 403. Um token novo so nasce no login ou se o cookie
    // nao existir/estiver mal formado.
    const csrfToken = this.reuseOrIssueCsrf(cookies, res);
    // userId: a tab antiga compara-o com o utilizador que mostra antes de
    // repetir um pedido apos um 403 de CSRF. Se outra tab entrou com outra
    // conta, o pedido nao e repetido nessa conta (F-05). E o id do proprio
    // utilizador da sessao, nada de novo e exposto.
    return { authenticated: true, csrfToken, userId: payload.sub };
  }

  // Logout: revoga a sessao DESTE dispositivo no servidor (nao so apaga os
  // cookies do browser) e limpa os cookies. Uma falha a revogar so fica no
  // log: o browser sai sempre.
  async endCurrentDevice(req: Request, res: Response): Promise<void> {
    await this.revokeCurrentDevice(cookiesOf(req)[ACCESS_TOKEN_COOKIE]).catch(
      (err) => {
        this.logger.warn(`Could not revoke session on logout: ${String(err)}`);
      },
    );
    this.clearSessionCookies(res);
  }

  /**
   * Interruptor global mantendo este dispositivo: sobe a tokenVersion,
   * revoga as outras sessoes e emite um JWT novo para a atual. Um pedido com
   * JWT antigo (sem `sid`) ganha aqui uma sessao nova com refresh token.
   */
  async keepOnlyCurrentDevice(
    user: AuthenticatedUser,
    req: Request,
    res: Response,
    reason: SessionRevokeReason,
  ): Promise<void> {
    const fresh = await this.authService.revokeAllSessions(
      user.id,
      user.sessionId,
      reason,
    );
    if (user.sessionId) {
      res.cookie(
        ACCESS_TOKEN_COOKIE,
        this.authService.issueJwt(fresh, user.sessionId),
        accessTokenCookieOptions(),
      );
      return;
    }
    await this.adoptLegacyDeviceSession(fresh, req, res);
  }

  clearSessionCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions());
  }

  // true se o pedido ja traz um JWT valido, do mesmo utilizador e versao,
  // de uma sessao de dispositivo ativa: emite so um JWT novo para ela.
  async continueDeviceSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<boolean> {
    const payload = this.authService.verifyAccessTokenCookie(
      cookiesOf(req)[ACCESS_TOKEN_COOKIE],
    );
    if (
      !payload?.sid ||
      'purpose' in payload ||
      payload.sub !== user.id ||
      !isSessionCurrent(payload.tv, user.tokenVersion) ||
      !(await this.userSessions.isActive(payload.sid, user.id))
    ) {
      return false;
    }
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      this.authService.issueJwt(user, payload.sid),
      accessTokenCookieOptions(),
    );
    return true;
  }

  /**
   * Logout: revoga a sessao do dispositivo indicada pelo JWT do cookie, mesmo
   * ja expirado (a assinatura e verificada). Um JWT antigo sem `sid` so pode
   * ser invalidado pela tokenVersion (todas as sessoes), como antes, e so se
   * ainda estiver dentro da validade.
   */
  async revokeCurrentDevice(accessToken: string | undefined): Promise<void> {
    const payload = this.authService.verifyAccessTokenCookie(accessToken, {
      ignoreExpiration: true,
    });
    if (!payload || 'purpose' in payload) return;
    if (payload.sid) {
      await this.userSessions.revoke(
        payload.sub,
        payload.sid,
        SessionRevokeReason.LOGOUT,
      );
      return;
    }
    if (this.authService.verifyAccessTokenCookie(accessToken)) {
      await this.authService.revokeAllSessions(payload.sub);
    }
  }

  // Ver GET /auth/csrf: troca um JWT antigo (sem `sid`) por uma sessao de
  // dispositivo. false se o token ja nao vale (versao antiga ou conta apagada).
  async upgradeLegacySession(
    userId: string,
    tokenVersion: number | undefined,
    req: Request,
    res: Response,
  ): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !isSessionCurrent(tokenVersion, user.tokenVersion)) {
      return false;
    }
    await this.adoptLegacyDeviceSession(user, req, res);
    this.logger.log(`Legacy session upgraded - user id=${user.id}`);
    return true;
  }

  // Cria a sessao do dispositivo (UserSession) e poe os cookies do JWT de
  // acesso e do refresh token. Usado por TODOS os caminhos de login.
  private async startDeviceSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<string> {
    const session = await this.userSessions.create(user, clientInfo(req));
    this.setDeviceSessionCookies(res, user, session);
    return session.sessionId;
  }

  // Mesma coisa para um browser que ja tinha login com um JWT antigo (sem
  // `sid`): ganha a sessao de dispositivo sem o alerta de "novo dispositivo"
  // (nao e um inicio de sessao novo, ver UserSessionsService.adoptLegacy).
  private async adoptLegacyDeviceSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<void> {
    const session = await this.userSessions.adoptLegacy(user, clientInfo(req));
    this.setDeviceSessionCookies(res, user, session);
  }

  private setDeviceSessionCookies(
    res: Response,
    user: User,
    session: { sessionId: string; refreshToken: string },
  ): void {
    res.cookie(
      ACCESS_TOKEN_COOKIE,
      this.authService.issueJwt(user, session.sessionId),
      accessTokenCookieOptions(),
    );
    res.cookie(
      REFRESH_TOKEN_COOKIE,
      session.refreshToken,
      refreshTokenCookieOptions(),
    );
  }

  // Reutiliza o token CSRF do cookie se estiver bem formado, senao cria um.
  // Reescreve sempre o cookie: renova a validade (maxAge) do token reutilizado.
  private reuseOrIssueCsrf(cookies: CookieJar, res: Response): string {
    const existing = cookies[CSRF_COOKIE];
    const csrfToken = isWellFormedCsrfToken(existing)
      ? existing
      : this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return csrfToken;
  }
}
