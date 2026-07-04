import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
  HttpCode,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { User } from '@prisma/client';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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

// URL do frontend para onde se redireciona depois do callback, com o JWT
// como query param. Ajustar em produção (Fase 6) para o domínio real.
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService
  ) {}
  

  // ---------------- EMAIL + PASSWORD ----------------
  // Coexiste com o OAuth: cria/autentica um User com password local e
  // devolve o mesmo formato de resposta { token } que o frontend já espera.

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto) {
    const user = await this.authService.registerWithPassword(dto);
    const token = this.authService.issueJwt(user);
    return { token };
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    const user = await this.authService.loginWithPassword(
      dto.email,
      dto.password,
    );
    const token = this.authService.issueJwt(user);
    return { token };
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
    return this.issueJwtAndRedirect(req, res);
  }

  // Ligar conta Google a um utilizador já autenticado (precisa de JWT válido
  // no header Authorization). O GoogleLinkGuard gera o state assinado e
  // injeta-o no pedido de autorização ao Google.
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
    return this.issueJwtAndRedirect(req, res);
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
    return this.issueJwtAndRedirect(req, res);
  }

  @Get('discord/link')
  @UseGuards(JwtAuthGuard, DiscordLinkGuard)
  discordLink() {}

  // ---------------- SESSÃO ATUAL ----------------

  // Rota de teste/utilidade: devolve o payload do JWT atual.
  // Útil para o frontend confirmar que o token é válido.
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
      // Já estava em Inglês
      throw new UnauthorizedException('User not found');
    }

    return profile;
  }

  private issueJwtAndRedirect(req: Request, res: Response) {
    const user = req.user as User;
    const token = this.authService.issueJwt(user);
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
  }

  // ---------------- API KEYS ----------------

  @Post('api-keys')
  @UseGuards(JwtAuthGuard)
  async createApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Body('name') name: string,
  ) {
    // Traduzido para Inglês
    return this.authService.generateApiKey(user.id, name || 'Generic API Key');
  }

  @Delete('api-keys/:id')
  @UseGuards(JwtAuthGuard)
  async revokeApiKey(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') keyId: string,
  ) {
    await this.authService.revokeApiKey(user.id, keyId);
    // Traduzido para Inglês
    return { message: 'API Key revoked successfully.' };
  }
}