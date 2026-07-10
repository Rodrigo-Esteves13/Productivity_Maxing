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
  HttpCode,
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
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { SetPasswordDto } from './dto/set-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleLinkGuard } from './guards/google-link.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GithubLinkGuard } from './guards/github-link.guard';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { DiscordLinkGuard } from './guards/discord-link.guard';
import { OAuthConflictRedirectFilter } from './filters/oauth-conflict-redirect.filter';
import { CurrentUser } from './decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  OAUTH_LOGIN_STATE_COOKIE,
  accessTokenCookieOptions,
  csrfCookieOptions,
  clearCookieOptions,
} from './cookie.config';

// URL do frontend para onde se redireciona depois do callback OAuth.
// Ajustar em produção para o domínio real (Netlify).
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('RequestLog');

  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
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
  @HttpCode(201)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.registerWithPassword(dto);
    return this.establishSession(user, res);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.loginWithPassword(
      dto.email,
      dto.password,
    );
    return this.establishSession(user, res);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());
    return { message: 'Logged out.' };
  }

  // Pública (não exige sessão) - pede ao Supabase para enviar o email de
  // recuperação. A resposta é sempre a mesma mensagem genérica, quer o
  // email exista ou não, para não dar pistas a quem esteja a tentar
  // enumerar contas.
  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto.email);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
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
    const cookies = req.cookies as Record<string, string | undefined>;
    const payload = this.authService.verifyAccessTokenCookie(
      cookies?.[ACCESS_TOKEN_COOKIE],
    );

    if (!payload) {
      return { authenticated: false };
    }

    const csrfToken = this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return { authenticated: true, csrfToken };
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
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        // Só usado para derivar hasPassword abaixo - nunca sai do backend.
        supabaseAuthId: true,
      },
    });

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    const { supabaseAuthId, ...rest } = profile;
    // hasPassword informa o frontend se deve mostrar "Change password" ou
    // "Add password" no EditProfileModal - true só quando já existe uma
    // credencial real no Supabase Auth associada a este User.
    return { ...rest, hasPassword: !!supabaseAuthId };
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
    return this.authService.updateProfile(user.id, { name: dto.name });
  }

  // Define ou muda a password da conta autenticada. Não pede a password
  // atual - a sessão válida (cookie + CSRF) já prova a posse da conta, e é
  // exatamente o mesmo nível de confiança que o resto das rotas /auth/me/*.
  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetPasswordDto,
  ) {
    await this.authService.setPassword(user.id, dto.password);
    return { message: 'Password updated successfully.' };
  }

  // Upload da foto de perfil: recebe multipart/form-data com um campo
  // "avatar", guarda no bucket do Supabase Storage, e grava o URL público
  // resultante no User. Limite de 5MB para não abusarmos do storage.
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
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
        fileSize: 5 * 1024 * 1024,
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
    return this.authService.uploadAvatar(user.id, file);
  }

  // Remove a foto de perfil atual (volta a mostrar as iniciais no frontend).
  @Delete('me/avatar')
  @UseGuards(JwtAuthGuard)
  async deleteAvatar(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.removeAvatar(user.id);
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
    await this.authService.deleteAccount(user.id);

    res.clearCookie(ACCESS_TOKEN_COOKIE, clearCookieOptions());
    res.clearCookie(CSRF_COOKIE, clearCookieOptions());

    return { message: 'Account deleted.' };
  }

  // Define os cookies de sessão (JWT + CSRF) e devolve o csrfToken no corpo,
  // para os fluxos de login/register que respondem diretamente ao frontend
  // (o frontend não precisa de ler cookies à mão, só guarda o valor devolvido
  // aqui em memória).
  private establishSession(user: User, res: Response) {
    const token = this.authService.issueJwt(user);
    const csrfToken = this.authService.generateCsrfToken();

    res.cookie(ACCESS_TOKEN_COOKIE, token, accessTokenCookieOptions());
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());

    this.logger.log(
      `Login (email/password) - user: ${user.email} (id=${user.id}, role=${user.role})`,
    );

    return { csrfToken };
  }

  // Mesma coisa, mas para os callbacks OAuth, que respondem com um redirect
  // em vez de um JSON body - por isso o csrfToken não vai aqui, o frontend
  // pede-o à parte em GET /auth/csrf assim que aterra em /auth/callback.
  private issueSessionAndRedirect(req: Request, res: Response) {
    const user = req.user as User;
    const token = this.authService.issueJwt(user);

    res.cookie(ACCESS_TOKEN_COOKIE, token, accessTokenCookieOptions());
    // Já não precisamos do state anti-CSRF do login OAuth depois de
    // consumido - limpa-o para não ficar pendurado nem ser reutilizável.
    res.clearCookie(OAUTH_LOGIN_STATE_COOKIE, { path: '/', sameSite: 'lax' });

    this.logger.log(
      `Login (OAuth) - user: ${user.email} (id=${user.id}, role=${user.role})`,
    );

    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }

  // API KEYS

  // Sem isto, um utilizador autenticado (ou uma conta comprometida) conseguia
  // gerar API Keys em loop sem qualquer limite, o que não é um IDOR nem um
  // leak, mas polui a tabela ApiKey e permite abuso do storage/BD.
  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body('name') name: string,
  ) {
    return this.authService.generateApiKey(user.id, name || 'Generic API Key');
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
