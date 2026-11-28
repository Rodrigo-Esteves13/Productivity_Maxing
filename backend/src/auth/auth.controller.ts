import {
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_UPLOADS_PER_MINUTE,
  singleFileUpload,
} from '../common/upload-limits';
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
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import 'multer';
import type { Request, Response } from 'express';
import { Role, SessionRevokeReason } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserSessionsService } from './services/user-sessions.service';
import { SessionCookieService } from './services/session-cookie.service';
import { ProfileService } from './services/profile.service';
import { isAllowedRefreshOrigin } from './refresh-origin.util';
import {
  REFRESH_IP_CEILING_PER_MINUTE,
  REFRESH_REQUESTS_PER_MINUTE,
  SESSION_REVOKE_OTHERS_REQUESTS_PER_MINUTE,
  SESSION_REVOKE_REQUESTS_PER_MINUTE,
} from './dto/auth-limits';
import {
  API_KEY_CREATE_REQUESTS_PER_MINUTE,
  FORGOT_PASSWORD_REQUESTS_PER_MINUTE,
  LOGIN_REQUESTS_PER_MINUTE,
  PASSWORD_LINK_REQUESTS_PER_MINUTE,
  REGISTER_REQUESTS_PER_MINUTE,
  RESEND_VERIFICATION_REQUESTS_PER_MINUTE,
  RESET_PASSWORD_REQUESTS_PER_MINUTE,
  SET_PASSWORD_REQUESTS_PER_MINUTE,
  TWO_FACTOR_LOGIN_REQUESTS_PER_MINUTE,
  TWO_FACTOR_MANAGE_REQUESTS_PER_MINUTE,
  VERIFY_EMAIL_REQUESTS_PER_MINUTE,
} from './auth.constants';
import { RegisterDto } from './dto/register.dto';
import { RenameApiKeyDto } from './dto/rename-api-key.dto';
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
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { getFrontendUrl } from '../config/app.config';
import {
  ThrottleIpCeiling,
  perMinute,
  perMinuteTrackedBy,
} from '../common/throttle.util';
import { refreshThrottleTracker } from './refresh-throttle.tracker';

// Origem do frontend aceite no POST /auth/refresh (ver refresh-origin.util).
const FRONTEND_URL = getFrontendUrl();

// Controller fino: as regras de sessao e cookies vivem no
// SessionCookieService e a forma do perfil no ProfileService.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userSessions: UserSessionsService,
    private readonly sessionCookies: SessionCookieService,
    private readonly profiles: ProfileService,
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
  @Throttle(perMinute(REGISTER_REQUESTS_PER_MINUTE))
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
    return this.sessionCookies.establishSession(user, req, res);
  }

  // Link do email de verificação. Pública e SEM CSRF de propósito: o token
  // assinado no corpo é a única credencial (não depende de nenhuma sessão por
  // cookie, e quem clica no email pode nem ter sessão neste browser). Só
  // marca o email do próprio token como verificado - nunca abre sessão.
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(VERIFY_EMAIL_REQUESTS_PER_MINUTE))
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
  @Throttle(perMinute(PASSWORD_LINK_REQUESTS_PER_MINUTE))
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
  @Throttle(perMinute(RESEND_VERIFICATION_REQUESTS_PER_MINUTE))
  async resendVerification(@Body() dto: ResendVerificationDto) {
    await this.authService.resendVerificationEmail(dto.email);
    return {
      message:
        'If an account with that email is waiting for verification, a new link has been sent.',
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(LOGIN_REQUESTS_PER_MINUTE))
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
    return this.sessionCookies.establishSession(user, req, res);
  }

  // Segundo passo do login com 2FA (email+password e OAuth). Pública e sem
  // CSRF como o login: a credencial é o token do desafio + o código.
  @Post('2fa/login')
  @HttpCode(HttpStatus.OK)
  @SkipCsrf()
  @Throttle(perMinute(TWO_FACTOR_LOGIN_REQUESTS_PER_MINUTE))
  async twoFactorLogin(
    @Body() dto: TwoFactorLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.completeTwoFactorLogin(
      dto.token,
      dto.code,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
    );
    return this.sessionCookies.establishSession(user, req, res);
  }

  @Get('2fa/status')
  @UseGuards(JwtAuthGuard)
  twoFactorStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.twoFactorStatus(user.id);
  }

  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(TWO_FACTOR_MANAGE_REQUESTS_PER_MINUTE))
  beginTwoFactorSetup(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.beginTwoFactorSetup(user.id);
  }

  @Post('2fa/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(TWO_FACTOR_MANAGE_REQUESTS_PER_MINUTE))
  confirmTwoFactorSetup(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ) {
    return this.authService.confirmTwoFactorSetup(user.id, dto.code);
  }

  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(TWO_FACTOR_MANAGE_REQUESTS_PER_MINUTE))
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
    await this.sessionCookies.endCurrentDevice(req, res);
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
    return await this.sessionCookies.refreshSession(req, res);
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
    await this.sessionCookies.keepOnlyCurrentDevice(
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
      this.sessionCookies.clearSessionCookies(res);
    }
    return { message: 'Session revoked.' };
  }

  // Pública (não exige sessão) - pede ao Supabase para enviar o email de
  // recuperação. A resposta é sempre a mesma mensagem genérica, quer o
  // email exista ou não, para não dar pistas a quem esteja a tentar
  // enumerar contas.
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(FORGOT_PASSWORD_REQUESTS_PER_MINUTE))
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
  @Throttle(perMinute(RESET_PASSWORD_REQUESTS_PER_MINUTE))
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
  refreshCsrf(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.sessionCookies.resumeSession(req, res);
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
    return this.sessionCookies.issueSessionAndRedirect(req, res);
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
    return this.sessionCookies.issueSessionAndRedirect(req, res);
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
    return this.sessionCookies.issueSessionAndRedirect(req, res);
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
    return this.profiles.build(user.id);
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
      mutedPushKinds: dto.mutedPushKinds,
      spacedReviewsEnabled: dto.spacedReviewsEnabled,
      notesPrivateByDefault: dto.notesPrivateByDefault,
    });
    return this.profiles.build(user.id);
  }

  // Define ou muda a password da conta autenticada. Se a conta ja tem
  // password, pede a atual (uma sessao roubada nao chega para tomar a conta);
  // contas so-OAuth adicionam a primeira sem ela.
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(SET_PASSWORD_REQUESTS_PER_MINUTE))
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
    await this.sessionCookies.keepOnlyCurrentDevice(
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
  @Throttle(perMinute(AVATAR_UPLOADS_PER_MINUTE))
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    // 1 ficheiro, 0 campos extra e profundidade de aninhamento limitada
    // (mitigacao GHSA-72gw-mp4g-v24j, ver singleFileUpload): esta rota so
    // espera o campo "avatar".
    singleFileUpload('avatar', AVATAR_MAX_SIZE_BYTES),
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
    return this.profiles.build(user.id);
  }

  // Remove a foto de perfil atual (volta a mostrar as iniciais no frontend).
  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.removeAvatar(user.id);
    return this.profiles.build(user.id);
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

    this.sessionCookies.clearSessionCookies(res);

    return { message: 'Account deleted.' };
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
  @Throttle(perMinute(API_KEY_CREATE_REQUESTS_PER_MINUTE))
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

  @Patch('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  @Throttle(perMinute(API_KEY_CREATE_REQUESTS_PER_MINUTE))
  async renameApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) keyId: string,
    @Body() dto: RenameApiKeyDto,
  ) {
    return this.authService.renameApiKey(user.id, keyId, dto.name);
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) keyId: string,
  ) {
    await this.authService.revokeApiKey(user.id, keyId);
    return { message: 'API Key revoked successfully.' };
  }
}
