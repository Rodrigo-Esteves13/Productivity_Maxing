import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, scryptSync } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Provider, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  JwtPayload,
  LinkStatePayload,
} from './interfaces/jwt-payload.interface';

interface OAuthProfileData {
  provider: Provider;
  providerAccountId: string;
  email: string;
  name?: string;
  accessToken?: string;
  refreshToken?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly supabase: ReturnType<typeof createClient>;
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Anon key chega para signUp/signInWithPassword — são os mesmos endpoints
    // públicos que o supabase-js usaria no browser, não operações de admin
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    );
  }

  /**
   * Fluxo normal de login/registo via OAuth.
   * Ordem de resolução: Identity existente -> User por email -> criar User novo.
   * (decisão de arquitetura já fixada no projeto)
   */
  async resolveIdentity(data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          accessToken: data.accessToken,
          // o Google só manda refresh_token no primeiro consent; não sobrescrever com undefined
          refreshToken: data.refreshToken ?? existingIdentity.refreshToken,
        },
      });
      return existingIdentity.user;
    }

    let user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email: data.email,
          name: data.name,
        },
      });
    }

    await this.prisma.identity.create({
      data: {
        userId: user.id,
        provider: data.provider,
        providerAccountId: data.providerAccountId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      },
    });

    return user;
  }

  /**
   * Fluxo de "ligar conta": utilizador já autenticado (identificado pelo state
   * assinado, ver createLinkState/consumeLinkState) associa um novo provider
   * ao seu User existente, em vez de criar/procurar por email.
   */
  async linkIdentity(userId: string, data: OAuthProfileData): Promise<User> {
    const existingIdentity = await this.prisma.identity.findUnique({
      where: {
        provider_providerAccountId: {
          provider: data.provider,
          providerAccountId: data.providerAccountId,
        },
      },
    });

    if (existingIdentity && existingIdentity.userId !== userId) {
      throw new ConflictException(
        'This provider account is already linked to another user.',
      );
    }

    if (existingIdentity) {
      await this.prisma.identity.update({
        where: { id: existingIdentity.id },
        data: {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    } else {
      await this.prisma.identity.create({
        data: {
          userId,
          provider: data.provider,
          providerAccountId: data.providerAccountId,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        },
      });
    }

    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  // ---------------- LOGIN/REGISTO POR EMAIL+PASSWORD (via Supabase Auth) ----------------
  // Não guardamos nem validamos passwords aqui — isso é responsabilidade do
  // Supabase Auth (auth.users, hashing, etc.). O backend só faz de proxy:
  // 1. Pede ao Supabase para criar/autenticar o utilizador.
  // 2. Sincroniza um User espelho na nossa própria tabela `public.User`
  //    (mesma tabela que já é usada pelo fluxo OAuth), indexado por email.
  // 3. Emite o NOSSO JwtService normal, para que o resto da app (guards,
  //    JwtStrategy, /auth/me, etc.) não precise de saber que o Supabase existe.

  async registerWithPassword(data: {
    email: string;
    password: string;
    name?: string;
  }): Promise<User> {
    const { data: signUpData, error } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: data.name ? { data: { name: data.name } } : undefined,
    });

    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw new UnauthorizedException(error.message);
    }

    if (!signUpData.user) {
      // Acontece se o projeto Supabase tiver confirmação de email obrigatória
      // e ainda não houver sessão — o utilizador tem de confirmar antes de entrar.
      throw new UnauthorizedException(
        'Verifica o teu email para confirmares a conta antes de entrares.',
      );
    }

    this.logger.log(
      `Novo utilizador registado via Supabase: ${signUpData.user.id}`,
    );
    return this.syncLocalUser(data.email, data.name);
  }

  async loginWithPassword(email: string, password: string): Promise<User> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid credentials.');
    }

    const name =
      (data.user.user_metadata?.name as string | undefined) ?? undefined;
    return this.syncLocalUser(email, name);
  }

  /**
   * Garante que existe um User espelho na nossa BD para o email autenticado
   * pelo Supabase — mesma lógica de "find or create by email" já usada no
   * resolveIdentity() do fluxo OAuth, para os dois caminhos convergirem no
   * mesmo utilizador quando o email coincide.
   */
  private async syncLocalUser(email: string, name?: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return existing;

    return this.prisma.user.create({
      data: { id: randomUUID(), email, name },
    });
  }

  issueJwt(user: User): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, { expiresIn: '7d' });
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

  // GESTÃO DE API KEYS (Para Postman/Scripts externos)

  async generateApiKey(userId: string, name: string) {
    // 32 bytes de entropia pura
    const rawToken = randomBytes(32).toString('base64url');

    // Usamos o secret do servidor como "salt" para manter a segurança do ambiente.
    const secret = process.env.API_KEY_SECRET || 'fallback-secreto-em-dev';

    // 64 é o tamanho do hash em bytes.
    const keyHash = scryptSync(rawToken, secret, 64).toString('hex');

    await this.prisma.apiKey.create({
      data: { userId, keyHash, name },
    });

    this.logger.log(`API Key gerada para o utilizador: ${userId}`);
    return { apiKey: rawToken };
  }

  async validateApiKey(incomingToken: string): Promise<User | null> {
    const secret = process.env.API_KEY_SECRET || 'fallback-secreto-em-dev';

    // Repetimos o scryptSync com os mesmos parâmetros para verificar
    const keyHash = scryptSync(incomingToken, secret, 64).toString('hex');

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (apiKeyRecord) {
      this.prisma.apiKey
        .update({
          where: { id: apiKeyRecord.id },
          data: { lastUsed: new Date() },
        })
        .catch((e) =>
          this.logger.error('Erro ao atualizar lastUsed da API Key', e),
        );

      return apiKeyRecord.user;
    }

    this.logger.warn('Tentativa falhada de uso de API Key.');
    return null;
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.prisma.apiKey.delete({
      where: { id: keyId, userId },
    });
    this.logger.log(`API Key revogada. KeyID: ${keyId}`);
  }
}
