import { Injectable, Logger } from '@nestjs/common';
import { randomBytes, scrypt as scryptCallback } from 'crypto';
import { promisify } from 'util';
import { ApiKeyScope, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

// scryptSync bloqueia a thread principal do event loop enquanto corre -
// numa rota chamada em CADA pedido autenticado por API Key
// (ApiKeyStrategy.validate -> validateApiKey), isso significa que pedidos
// concorrentes de outros utilizadores ficam todos à espera atrás de um
// único cálculo de hash. A versão assíncrona corre no thread pool do
// libuv, sem bloquear o resto da app.
const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

// Gestao de API Keys (para Postman/scripts externos) e a validacao feita em
// cada pedido autenticado por x-api-key.
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(private prisma: PrismaService) {}

  // Nunca devolve keyHash - a raw key só existe uma vez, no momento da
  // criação (ver generateApiKey), exatamente como o GitHub faz com os
  // personal access tokens. Isto é só para o user ver o que já criou e
  // decidir o que revogar.
  async listApiKeys(userId: string) {
    return this.prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        scope: true,
        createdAt: true,
        lastUsed: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateApiKey(
    userId: string,
    name: string,
    requestedScope: ApiKeyScope,
    requesterRole: Role,
  ) {
    // Defense in depth: never trust the requested scope blindly, even
    // though the DTO/controller should already be doing this check. Only
    // an ADMIN user can ever mint an ADMIN-scoped key - a regular user
    // requesting ADMIN scope silently gets TASKS instead of a 403, same
    // as how a non-admin can't make themselves admin some other way.
    const scope =
      requestedScope === 'ADMIN' && requesterRole === 'ADMIN'
        ? 'ADMIN'
        : 'TASKS';

    // 32 bytes de entropia pura
    const rawToken = randomBytes(32).toString('base64url');

    // Usamos o secret do servidor como "salt" para manter a segurança do ambiente.
    // Sem fallback: se faltar em produção, é preferível a app não arrancar
    // (ver validação em main.ts) do que assinar API Keys com um segredo
    // público e previsível.
    const secret = this.requireApiKeySecret();

    // 64 é o tamanho do hash em bytes.
    const keyHash = (await scrypt(rawToken, secret, 64)).toString('hex');

    await this.prisma.apiKey.create({
      data: { userId, keyHash, name, scope },
    });

    this.logger.log(
      `API Key gerada para o utilizador: ${userId} (scope: ${scope})`,
    );
    return { apiKey: rawToken };
  }

  async validateApiKey(
    incomingToken: string,
  ): Promise<{ user: User; scope: ApiKeyScope } | null> {
    const secret = this.requireApiKeySecret();

    // Repetimos o mesmo cálculo (agora assíncrono) para verificar
    const keyHash = (await scrypt(incomingToken, secret, 64)).toString('hex');

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
        .catch((e: unknown) =>
          this.logger.error('Erro ao atualizar lastUsed da API Key', e instanceof Error ? e.message : String(e)),
        );

      return { user: apiKeyRecord.user, scope: apiKeyRecord.scope };
    }

    this.logger.warn('Tentativa falhada de uso de API Key.');
    return null;
  }

  private requireApiKeySecret(): string {
    const secret = process.env.API_KEY_SECRET;
    if (!secret) {
      // Falha alto e a gritar em vez de assinar/verificar API Keys com um
      // valor previsível - a validação de arranque em main.ts já devia ter
      // impedido a app de chegar aqui, isto é uma segunda linha de defesa.
      throw new Error(
        'API_KEY_SECRET is not defined. It is not safe to generate or validate API Keys without it.',
      );
    }
    return secret;
  }

  async revokeApiKey(userId: string, keyId: string) {
    await this.prisma.apiKey.delete({
      where: { id: keyId, userId },
    });
    this.logger.log(`API Key revogada. KeyID: ${keyId}`);
  }
}
