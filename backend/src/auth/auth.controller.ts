import { AVATAR_MAX_SIZE_BYTES } from '../common/upload-limits';
import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UseFilters,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import 'multer';
import type { Options as MulterOptions } from 'multer';

// @types/multer ainda não inclui `fieldNestingDepth` no tipo
// `Options.limits` (opção real do multer >=2.2.0, ver comentário junto do
// uso mais abaixo em uploadAvatar). Este tipo local só acrescenta essa
// propriedade em cima do tipo oficial, para o cast ficar restrito ao
// mínimo em vez de recorrer a `any`.
type MulterLimitsWithFieldNestingDepth = NonNullable<
  MulterOptions['limits']
> & {
  fieldNestingDepth?: number;
};
import type { Request, Response } from 'express';
import { User, Role, SessionRevokeReason } from '@prisma/client';
import { AuthService } from './auth.service';
import {
  UserSessionsService,
  type SessionClientInfo,
} from './services/user-sessions.service';
import { isSessionCurrent } from './session-version.util';
import { isAllowedRefreshOrigin } from './refresh-origin.util';
import {
  REFRESH_IP_CEILING_PER_MINUTE,
  REFRESH_REQUESTS_PER_MINUTE,
  SESSION_REVOKE_OTHERS_REQUESTS_PER_MINUTE,
  SESSION_REVOKE_REQUESTS_PER_MINUTE,
} from './dto/auth-limits';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResendVerificationDto, VerifyEmailDto } from './dto/verify-email.dto';
import {
  CompletePasswordLinkDto,
  CompletePasswordResetDto,
} from './dto/password-link.dto';
import { TwoFactorCodeDto, TwoFactorLoginDto } from './dto/two-factor.dto';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import { SetPasswordDto } from './dto/set-password.dto';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleLinkGuard } from './guards/google-link.guard';
import { GoogleCalendarLinkGuard } from './guards/google-calendar-link.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GithubLinkGuard } from './guards/github-link.guard';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { DiscordLinkGuard } from './guards/discord-link.guard';
import { OAuthConflictRedirectFilter } from './filters/oauth-conflict-redirect.filter';
import { CurrentUser } from './decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { getFrontendUrl, isTwoFactorEnabled } from '../config/app.config';
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
} from './cookie.config';
import { isWellFormedCsrfToken } from './csrf-token.util';
import {
  ThrottleIpCeiling,
  perMinute,
  perMinuteTrackedBy,
} from '../common/throttle.util';
import { refreshThrottleTracker } from './refresh-throttle.tracker';

// URL do frontend para onde se redireciona depois do callback OAuth.
// Ajustar em produção para o domínio real (Netlify).
const FRONTEND_URL = getFrontendUrl();

// Dados do pedido guardados (reduzidos) na sessao do dispositivo.
function clientInfo(req: Request): SessionClientInfo {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    method: req.method,
    path: req.path,
  };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('RequestLog');

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
    private readonly userSessions: UserSessionsService,
  ) {}

  // EMAIL + PASSWORD
  // Coexiste com o OAuth: cria/autentica um User com password local e
  // estabelece a sessão via cookie HttpOnly (Design B) em vez de devolver o
  // token no corpo da resposta.

  // O ThrottlerGuard global (100 pedidos/min por IP) não chega para
  // proteger contra força bruta de credenciais - dá margem de sobra para
  // testar wordlists pequenas. Estes limites mais apertados aplicam-se
  // especificamente a estas rotas, por cima do guard global.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(perMinute(3))
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const outcome = await this.authService.registerWithPassword(dto);
    // Email de uma conta que ainda não tem password: o link para a juntar
    // foi para a caixa do dono, aqui não há sessão nenhuma.
    if (outcome.kind === 'password-link-sent') {
      return { passwordLinkSent: true as const, email: outcome.email };
    }
    const { user } = outcome;
    // Com REQUIRE_EMAIL_VERIFICATION ligada não há sessão até o email estar
    // verificado: o link já foi enviado (ver PasswordAuthService). Com a
    // flag desligada isto nunca é true e o fluxo é o de sempre.
    if (this.authService.needsEmailVerification(user)) {
      return { requiresEmailVerification: true as const, email: user.email };
    }
    return this.establishSession(user, req, res);
  }

  // Link do email de verificação. Pública e SEM CSRF de propósito: o token
  // assinado no corpo é a única credencial (não depende de nenhuma sessão por
  // cookie, e quem clica no email pode nem ter sessão neste browser). Só
  // marca o email do próprio token como verificado - nunca abre sessão.
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(10))
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    const { email } = await this.authService.verifyEmail(dto.token);
    return { verified: true, email };
  }

  // Link do email "adicionar password" (ver PasswordLinkService). Pública e
  // SEM CSRF pelo mesmo motivo do verify-email: o token assinado no corpo é
  // a única credencial. Cria a password mas não abre sessão (o login a
  // seguir passa pelo 2FA como sempre).
  @Post('password-link')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(5))
  async completePasswordLink(@Body() dto: CompletePasswordLinkDto) {
    const { email } = await this.authService.completePasswordLink(
      dto.token,
      dto.password,
    );
    return { linked: true as const, email };
  }

  // Reenvio do link. Resposta sempre genérica, exista a conta ou não.
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(3))
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'If an account with that email is waiting for verification, a new link has been sent.',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.loginWithPassword(
      dto.email,
      dto.password,
    );
    // 2FA (só com TWO_FACTOR_ENABLED=true E a conta tê-lo ativado): em vez
    // de sessão devolve um token curto; o código vai a POST /auth/2fa/login.
    if (this.authService.requiresTwoFactor(user)) {
      return {
        requiresTwoFactor: true as const,
        twoFactorToken: this.authService.createTwoFactorChallenge(user),
      };
    }
    return this.establishSession(user, req, res);
  }

  // Segundo passo do login com 2FA (email+password e OAuth). Pública e sem
  // CSRF como o login: a credencial é o token do desafio + o código.
  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(10))
  async twoFactorLogin(
    @Body() dto: TwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.completeTwoFactorLogin(
      dto.token,
      dto.code,
    );
    return this.establishSession(user, req, res);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  twoFactorStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.twoFactorStatus(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(10))
  beginTwoFactorSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.beginTwoFactorSetup(user.id);
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(10))
  confirmTwoFactorSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.confirmTwoFactorSetup(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(10))
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    await this.authService.disableTwoFactor(user.id, dto.code);
    return { enabled: false };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // Terminar sessao revoga a sessao DESTE dispositivo no servidor (nao so
    // apaga os cookies do browser): um cookie copiado antes deixa de
    // funcionar, e os outros dispositivos continuam com sessao (para os
    // terminar ha "Sign out all other devices" na pagina Devices).
    await this.revokeCurrentDevice(
      req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined,
    ).catch((err) => {
      this.logger.warn(`Could not revoke session on logout: ${String(err)}`);
    });
    this.clearSessionCookies(res);
    return { message: 'Logged out.' };
  }

  // Renova a sessao: troca o refresh token (cookie restrito a esta rota) por
  // um novo e emite um JWT de acesso novo. O token roda em todos os usos e
  // a reutilizacao de um token antigo revoga a sessao (ver
  // UserSessionsService.rotate). CSRF: ver refresh-origin.util.ts (o
  // double-submit nao serve aqui, o frontend pode nao ter o token CSRF).
  // Rate limit por sessao de dispositivo (cookie com HMAC valido; senao por
  // IP), com um teto por IP largo: ver refresh-throttle.tracker.ts.
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(
    perMinuteTrackedBy(REFRESH_REQUESTS_PER_MINUTE, refreshThrottleTracker),
  )
  @ThrottleIpCeiling(REFRESH_IP_CEILING_PER_MINUTE)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!isAllowedRefreshOrigin(req.headers.origin, FRONTEND_URL)) {
      throw new ForbiddenException('Invalid request origin.');
    }
    const cookies = req.cookies as Record<string, string | undefined>;
    // Numa rejeicao NAO se apagam os cookies: se dois pedidos do mesmo
    // browser colidirem, o Set-Cookie de "apagar" do perdedor podia chegar
    // depois do token novo do vencedor e apaga-lo. O frontend trata o 401
    // como sessao terminada e o logout limpa tudo.
    const rotated = await this.userSessions.rotate(
      cookies?.[REFRESH_TOKEN_COOKIE],
      clientInfo(req),
    );
    this.setDeviceSessionCookies(res, rotated.user, rotated);

    // Reutiliza o token CSRF que o browser ja tem (outras tabs guardam-no em
    // memoria, ver GET /auth/csrf); so cria um se nao existir.
    const existing = cookies?.[CSRF_COOKIE];
    const csrfToken = isWellFormedCsrfToken(existing)
      ? existing
      : this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return { csrfToken, userId: rotated.user.id };
  }

  // SESSOES POR DISPOSITIVO (pagina Devices)
  // Rotas literais antes de /sessions/:id.

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  listSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.userSessions.list(user.id, user.sessionId);
  }

  // Termina todas as outras sessoes: sobe a tokenVersion (o interruptor
  // global, apanha tambem JWTs antigos sem `sid`) e este dispositivo
  // continua com um token novo.
  @Post('sessions/revoke-others')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(SESSION_REVOKE_OTHERS_REQUESTS_PER_MINUTE))
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.keepOnlyCurrentDevice(
      user,
      req,
      res,
      SessionRevokeReason.SIGNED_OUT_OTHERS,
    );
    return { message: 'Signed out of all other devices.' };
  }

  // Revoga uma sessao do proprio utilizador. O userId vai no where (ver
  // UserSessionsService.revoke): o id de outra pessoa da 404, igual a um id
  // que nao existe, para nao confirmar que existe.
  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(SESSION_REVOKE_REQUESTS_PER_MINUTE))
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const revoked = await this.userSessions.revoke(
      user.id,
      sessionId,
      SessionRevokeReason.REVOKED_BY_USER,
    );
    if (!revoked) {
      throw new NotFoundException('Session not found.');
    }
    // Revogar a propria sessao equivale a terminar sessao aqui.
    if (sessionId === user.sessionId) {
      this.clearSessionCookies(res);
    }
    return { message: 'Session revoked.' };
  }

  // Pública (não exige sessão) - pede ao Supabase para enviar o email de
  // recuperação. A resposta é sempre a mesma mensagem genérica, quer o
  // email exista ou não, para não dar pistas a quem esteja a tentar
  // enumerar contas.
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(3))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  // Pública: chamada pela página /reset-password com o access token da
  // sessão de recovery do Supabase (validado no servidor). Muda a password e
  // termina todas as sessões da conta, como o PATCH /auth/me/password (E-02).
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  async completePasswordReset(@Body() dto: CompletePasswordResetDto) {
    await this.authService.completePasswordReset(dto.accessToken, dto.password);
    return { message: 'Password updated successfully.' };
  }

  // Chamado pelo frontend logo a seguir a um redirect de OAuth (o cookie já
  // foi definido pelo backend nesse redirect, mas o corpo de um redirect não
  // consegue transportar o csrfToken - por isso o frontend pede-o aqui,
  // já autenticado pelo cookie que acabou de chegar).
  // Chamado pelo frontend logo a seguir a um redirect de OAuth, e também no
  // arranque da app para verificar se a sessão ainda é válida. Devolve
  // sempre 200 (nunca 401) - "não estás autenticado" é um estado normal
  // aqui, não um erro, e um 401 fazia o DevTools mostrar uma linha vermelha
  // sempre que a app arrancasse sem sessão.
  @Get('csrf')
  async refreshCsrf(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookies = req.cookies as Record<string, string | undefined>;
    const accessToken = cookies?.[ACCESS_TOKEN_COOKIE];
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
    const existing = cookies?.[CSRF_COOKIE];
    const csrfToken = isWellFormedCsrfToken(existing)
      ? existing
      : this.authService.generateCsrfToken();
    // Reescreve sempre o cookie: renova a validade (maxAge) do token reutilizado.
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    // userId: a tab antiga compara-o com o utilizador que mostra antes de
    // repetir um pedido apos um 403 de CSRF. Se outra tab entrou com outra
    // conta, o pedido nao e repetido nessa conta (F-05). E o id do proprio
    // utilizador da sessao, nada de novo e exposto.
    return { authenticated: true, csrfToken, userId: payload.sub };
  }
  // GOOGLE

  // Login normal: redireciona para o consent screen do Google.
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // nunca corre - o Guard intercepta e redireciona antes de chegar aqui
  }

  // Callback do Google. A GoogleStrategy já decide sozinha, com base na
  // presença (ou não) de ?state=, se isto é um login normal ou um link
  // de conta, e devolve o User certo em req.user.
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(OAuthConflictRedirectFilter)
  googleCallback(@Req() req: Request, @Res() res: Response) {
    return this.issueSessionAndRedirect(req, res);
  }

  // Ligar conta Google a um utilizador já autenticado (precisa da sessão por
  // cookie válida). O GoogleLinkGuard gera o state assinado e injeta-o no
  // pedido de autorização ao Google.
  @Get('google/link')
  @UseGuards(JwtAuthGuard, GoogleLinkGuard)
  googleLink() {
    // idem, nunca corre
  }

  // Ligar (ou re-autorizar com scope extra) o acesso ao Google Calendar.
  // Distinto de /auth/google/link: este pede também o scope
  // calendar.app.created. Ver GoogleCalendarLinkGuard. (Issue #34)
  @Get('google/link-calendar')
  @UseGuards(JwtAuthGuard, GoogleCalendarLinkGuard)
  googleLinkCalendar() {
    // nunca corre - o Guard intercepta e redireciona antes de chegar aqui
  }

  // Issue #38: revoga o acesso ao Calendar (mantém o login com Google
  // intacto, só remove o refreshToken/scope da Identity).
  @Delete('google/calendar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectGoogleCalendar(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.disconnectGoogleCalendar(user.id);
    return { message: 'Google Calendar disconnected.' };
  }

  // GITHUB

  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubLogin() {}

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  @UseFilters(OAuthConflictRedirectFilter)
  githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.issueSessionAndRedirect(req, res);
  }

  @Get('github/link')
  @UseGuards(JwtAuthGuard, GithubLinkGuard)
  githubLink() {}

  // DISCORD

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  discordLogin() {}

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  @UseFilters(OAuthConflictRedirectFilter)
  discordCallback(@Req() req: Request, @Res() res: Response) {
    return this.issueSessionAndRedirect(req, res);
  }

  @Get('discord/link')
  @UseGuards(JwtAuthGuard, DiscordLinkGuard)
  discordLink() {}

  // SESSÃO ATUAL

  // Devolve o perfil do utilizador atual. Também serve para o frontend
  // confirmar, no arranque da app, se o cookie de sessão ainda é válido
  // (o cookie é HttpOnly, por isso o JS não o consegue verificar sozinho).
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.buildProfile(user.id);
  }

  // Forma ÚNICA do perfil devolvido ao frontend (GET /auth/me, PATCH /auth/me,
  // upload/remoção de avatar). Lista explícita de campos: devolver a linha
  // inteira do User expunha supabaseAuthId, tokenVersion, o segredo TOTP
  // cifrado, os hashes dos códigos de recuperação e o token do feed .ics.
  // Tem de ser igual em todas as rotas porque o frontend substitui o user em
  // memória pela resposta (derivados como hasPassword/emailVerified incluídos).
  private async buildProfile(userId: string) {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        // Dashboard ativo (Programa + Período) - o frontend usa isto para
        // saber logo no arranque qual seletor mostrar pré-selecionado, sem
        // precisar de um pedido extra.
        activeProgramId: true,
        activePeriodId: true,
        // Horário/plano de estudo (Fase 6) - ver User.commuteMinutes no
        // schema.prisma. O frontend precisa disto logo no arranque para
        // pré-preencher o CommuteSettingsCard sem um pedido extra.
        commuteMinutes: true,
        commuteMode: true,
        homeAddress: true,
        campusAddress: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        // Só usado para derivar emailVerified abaixo.
        emailVerifiedAt: true,
        deadlineEmailReminders: true,
        deadlinePushReminders: true,
        spacedReviewsEnabled: true,
        notesPrivateByDefault: true,
        // Só para twoFactorEnabled (o segredo nunca sai do backend).
        twoFactorEnabledAt: true,
        // Só usado para derivar hasPassword abaixo - nunca sai do backend.
        supabaseAuthId: true,
      },
    });

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    const { supabaseAuthId, emailVerifiedAt, twoFactorEnabledAt, ...rest } =
      profile;
    // hasPassword informa o frontend se deve mostrar "Change password" ou
    // "Add password" no EditProfileModal - true só quando já existe uma
    // credencial real no Supabase Auth associada a este User.
    return {
      ...rest,
      hasPassword: !!supabaseAuthId,
      emailVerified: emailVerifiedAt !== null,
      twoFactorAvailable: isTwoFactorEnabled(),
      twoFactorEnabled: twoFactorEnabledAt !== null,
    };
  }

  // Atualiza campos de texto do perfil (por agora só o nome).
  // O avatar tem endpoints próprios logo a seguir, porque é um upload
  // de ficheiro e não faz sentido aceitar uma avatarUrl arbitrária vinda
  // do cliente.
  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    await this.authService.updateProfile(user.id, {
      name: dto.name,
      commuteMinutes: dto.commuteMinutes,
      commuteMode: dto.commuteMode,
      homeAddress: dto.homeAddress,
      campusAddress: dto.campusAddress,
      quietHoursStart: dto.quietHoursStart,
      quietHoursEnd: dto.quietHoursEnd,
      deadlineEmailReminders: dto.deadlineEmailReminders,
      deadlinePushReminders: dto.deadlinePushReminders,
      spacedReviewsEnabled: dto.spacedReviewsEnabled,
      notesPrivateByDefault: dto.notesPrivateByDefault,
    });
    return this.buildProfile(user.id);
  }

  // Define ou muda a password da conta autenticada. Se a conta ja tem
  // password, pede a atual (uma sessao roubada nao chega para tomar a conta);
  // contas so-OAuth adicionam a primeira sem ela.
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  async setPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.setPassword(
      user.id,
      dto.password,
      dto.currentPassword,
    );
    // Mudar a password termina todas as outras sessoes (quem tivesse o
    // cookie antigo fica de fora); esta continua, com um token novo.
    await this.keepOnlyCurrentDevice(
      user,
      req,
      res,
      SessionRevokeReason.GLOBAL_SIGNOUT,
    );
    return { message: 'Password updated successfully.' };
  }

  // Upload da foto de perfil: recebe multipart/form-data com um campo
  // "avatar", guarda no bucket do Supabase Storage, e grava o URL público
  // resultante no User. Limite de 5MB para não abusarmos do storage.
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('avatar', {
      // fileSize: já existia. fields/files/fieldNestingDepth: mitigação para
      // a vulnerabilidade do multer (GHSA-72gw-mp4g-v24j, npm audit) de DoS
      // via nomes de campo profundamente aninhados num multipart/form-data -
      // limitamos explicitamente a 1 campo de ficheiro, nenhum campo de
      // texto extra e profundidade de aninhamento zero, já que esta rota só
      // espera o campo "avatar" (sem bracket notation nenhuma).
      //
      // `fieldNestingDepth` é uma opção real do multer >=2.2.0 (documentada
      // no README oficial), mas o @types/multer instalado ainda não foi
      // atualizado com esta propriedade no tipo `Options.limits` - daí o
      // TS2353. O cast abaixo é *só* para esta propriedade extra; o resto
      // do objeto continua totalmente tipado. Remover o cast quando o
      // @types/multer apanhar o tipo (confirmar com `npm ls @types/multer`
      // e o changelog do pacote).
      limits: {
        fileSize: AVATAR_MAX_SIZE_BYTES,
        files: 1,
        fields: 1,
        fieldNestingDepth: 1,
      } as MulterLimitsWithFieldNestingDepth,
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file was sent (field name must be "avatar").',
      );
    }
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image.');
    }
    await this.authService.uploadAvatar(user.id, file);
    return this.buildProfile(user.id);
  }

  // Remove a foto de perfil atual (volta a mostrar as iniciais no frontend).
  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.removeAvatar(user.id);
    return this.buildProfile(user.id);
  }

  // Apaga a conta em definitivo (irreversível): remove o avatar do Storage,
  // o User e tudo o que dependia dele (tasks, identities, api keys, via
  // cascade no schema.prisma), e limpa a sessão atual.
  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    // As sessoes de dispositivo vao com o User (onDelete: Cascade).
    await this.authService.deleteAccount(user.id);

    this.clearSessionCookies(res);

    return { message: 'Account deleted.' };
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

  // true se o pedido ja traz um JWT valido, do mesmo utilizador e versao,
  // de uma sessao de dispositivo ativa: emite so um JWT novo para ela.
  private async continueDeviceSession(
    user: User,
    req: Request,
    res: Response,
  ): Promise<boolean> {
    const payload = this.authService.verifyAccessTokenCookie(
      req.cookies?.[ACCESS_TOKEN_COOKIE] as string | undefined,
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

  private clearSessionCookies(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());
    res.clearCookie(REFRESH_TOKEN_COOKIE, clearRefreshCookieOptions());
  }

  /**
   * Interruptor global mantendo este dispositivo: sobe a tokenVersion,
   * revoga as outras sessoes e emite um JWT novo para a atual. Um pedido com
   * JWT antigo (sem `sid`) ganha aqui uma sessao nova com refresh token.
   */
  private async keepOnlyCurrentDevice(
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

  /**
   * Logout: revoga a sessao do dispositivo indicada pelo JWT do cookie, mesmo
   * ja expirado (a assinatura e verificada). Um JWT antigo sem `sid` so pode
   * ser invalidado pela tokenVersion (todas as sessoes), como antes, e so se
   * ainda estiver dentro da validade.
   */
  private async revokeCurrentDevice(
    accessToken: string | undefined,
  ): Promise<void> {
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
  private async upgradeLegacySession(
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

  // Define os cookies de sessão (JWT + refresh + CSRF) e devolve o csrfToken
  // no corpo, para os fluxos de login/register que respondem diretamente ao
  // frontend (o frontend não precisa de ler cookies à mão, só guarda o valor
  // devolvido aqui em memória).
  private async establishSession(user: User, req: Request, res: Response) {
    await this.startDeviceSession(user, req, res);
    const csrfToken = this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());

    this.logger.log(
      `Login (email/password) - user: ${user.email} (id=${user.id}, role=${user.role})`,
    );

    return { csrfToken };
  }

  // Mesma coisa, mas para os callbacks OAuth, que respondem com um redirect
  // em vez de um JSON body - por isso o csrfToken não vai aqui, o frontend
  // pede-o à parte em GET /auth/csrf assim que aterra em /auth/callback.
  private async issueSessionAndRedirect(req: Request, res: Response) {
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

    this.logger.log(
      `Login (OAuth) - user: ${user.email} (id=${user.id}, role=${user.role})`,
    );

    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }

  // API KEYS

  @Get('api-keys')
  @UseGuards(JwtAuthGuard)
  async listApiKeys(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.listApiKeys(user.id);
  }

  // Sem isto, um utilizador autenticado (ou uma conta comprometida) conseguia
  // gerar API Keys em loop sem qualquer limite, o que não é um IDOR nem um
  // leak, mas polui a tabela ApiKey e permite abuso do storage/BD.
  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(5))
  async createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.authService.generateApiKey(
      user.id,
      dto.name || 'Generic API Key',
      dto.scope ?? 'TASKS',
      user.role as Role,
    );
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') keyId: string,
  ) {
    await this.authService.revokeApiKey(user.id, keyId);
    return { message: 'API Key revoked successfully.' };
  }
}
