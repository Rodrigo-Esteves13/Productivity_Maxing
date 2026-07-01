import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomBytes, createHash } from 'crypto';
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

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

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
        'Esta conta do provider já está associada a outro utilizador.',
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
          'State OAuth inválido para este provider.',
        );
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('State OAuth inválido ou expirado.');
    }
  }

  // GESTÃO DE API KEYS (Para Postman/Scripts externos)

  async generateApiKey(userId: string, name: string) {
    // 32 bytes de entropia pura
    const rawKey = randomBytes(32).toString('base64url');
    // Guardamos apenas o Hash SHA-256
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    await this.prisma.apiKey.create({
      data: { userId, keyHash, name },
    });

    this.logger.log(`API Key gerada para o utilizador: ${userId}`);

    // Retorna a chave em plain text UMA ÚNICA VEZ
    return { apiKey: rawKey };
  }

  async validateApiKey(incomingKey: string): Promise<User | null> {
    const keyHash = createHash('sha256').update(incomingKey).digest('hex');

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (apiKeyRecord) {
      // Atualiza lastUsed de forma não-bloqueante
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
