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
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  BadRequestException,
  HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import 'multer';
import type { Request, Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { GoogleLinkGuard } from './guards/google-link.guard';
import { GithubAuthGuard } from './guards/github-auth.guard';
import { GithubLinkGuard } from './guards/github-link.guard';
import { DiscordAuthGuard } from './guards/discord-auth.guard';
import { DiscordLinkGuard } from './guards/discord-link.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_COOKIE,
  accessTokenCookieOptions,
  csrfCookieOptions,
  clearCookieOptions,
} from './cookie.config';

// URL do frontend para onde se redireciona depois do callback OAuth.
// Ajustar em produção para o domínio real (Netlify).
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // ---------------- EMAIL + PASSWORD ----------------
  // Coexiste com o OAuth: cria/autentica um User com password local e
  // estabelece a sessão via cookie HttpOnly (Design B) em vez de devolver o
  // token no corpo da resposta.

  @Post('register')
  @HttpCode(201)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.registerWithPassword(dto);
    return this.establishSession(user, res);
  }

  @Post('login')
  @HttpCode(200)
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

  // Chamado pelo frontend logo a seguir a um redirect de OAuth (o cookie já
  // foi definido pelo backend nesse redirect, mas o corpo de um redirect não
  // consegue transportar o csrfToken - por isso o frontend pede-o aqui,
  // já autenticado pelo cookie que acabou de chegar).
  @Get('csrf')
  @UseGuards(JwtAuthGuard)
  refreshCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = this.authService.generateCsrfToken();
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());
    return { csrfToken };
  }

  // ---------------- GOOGLE ----------------

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

  // ---------------- GITHUB ----------------

  @Get('github')
  @UseGuards(GithubAuthGuard)
  githubLogin() {}

  @Get('github/callback')
  @UseGuards(GithubAuthGuard)
  githubCallback(@Req() req: Request, @Res() res: Response) {
    return this.issueSessionAndRedirect(req, res);
  }

  @Get('github/link')
  @UseGuards(JwtAuthGuard, GithubLinkGuard)
  githubLink() {}

  // ---------------- DISCORD ----------------

  @Get('discord')
  @UseGuards(DiscordAuthGuard)
  discordLogin() {}

  @Get('discord/callback')
  @UseGuards(DiscordAuthGuard)
  discordCallback(@Req() req: Request, @Res() res: Response) {
    return this.issueSessionAndRedirect(req, res);
  }

  @Get('discord/link')
  @UseGuards(JwtAuthGuard, DiscordLinkGuard)
  discordLink() {}

  // ---------------- SESSÃO ATUAL ----------------

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
      },
    });

    if (!profile) {
      throw new UnauthorizedException('User not found');
    }

    return profile;
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

  // Upload da foto de perfil: recebe multipart/form-data com um campo
  // "avatar", guarda no bucket do Supabase Storage, e grava o URL público
  // resultante no User. Limite de 5MB para não abusarmos do storage.
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
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

  // Define os cookies de sessão (JWT + CSRF) e devolve o csrfToken no corpo,
  // para os fluxos de login/register que respondem diretamente ao frontend
  // (o frontend não precisa de ler cookies à mão, só guarda o valor devolvido
  // aqui em memória).
  private establishSession(user: User, res: Response) {
    const token = this.authService.issueJwt(user);
    const csrfToken = this.authService.generateCsrfToken();

    res.cookie(ACCESS_TOKEN_COOKIE, token, accessTokenCookieOptions());
    res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions());

    return { csrfToken };
  }

  // Mesma coisa, mas para os callbacks OAuth, que respondem com um redirect
  // em vez de um JSON body - por isso o csrfToken não vai aqui, o frontend
  // pede-o à parte em GET /auth/csrf assim que aterra em /auth/callback.
  private issueSessionAndRedirect(req: Request, res: Response) {
    const user = req.user as User;
    const token = this.authService.issueJwt(user);

    res.cookie(ACCESS_TOKEN_COOKIE, token, accessTokenCookieOptions());

    return res.redirect(`${FRONTEND_URL}/auth/callback`);
  }

  // ---------------- API KEYS ----------------

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
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
