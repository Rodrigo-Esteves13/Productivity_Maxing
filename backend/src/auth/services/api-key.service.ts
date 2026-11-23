import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, scrypt as scryptCallback } from 'crypto';
import { ApiKeyScope, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  API_KEY_CACHE_MAX_ENTRIES,
  API_KEY_CACHE_TTL_MS,
  API_KEY_LAST_USED_DEBOUNCE_MS,
} from '../dto/auth-limits';

// Tamanho do hash scrypt guardado em ApiKey.keyHash, em bytes.
const KEY_HASH_BYTES = 64;
// Entropia da raw key gerada, em bytes.
const RAW_KEY_BYTES = 32;

interface CachedApiKey {
  keyId: string;
  user: User;
  scope: ApiKeyScope;
  expiresAt: number;
  // Ultimo lastUsed conhecido (da BD ou escrito por esta instancia).
  lastUsedAt: number | null;
}

// scryptSync bloqueia a thread principal do event loop enquanto corre -
// numa rota chamada em CADA pedido autenticado por API Key
// (ApiKeyStrategy.validate -> validateApiKey), isso significa que pedidos
// concorrentes de outros utilizadores ficam todos à espera atrás de um
// único cálculo de hash. A versão assíncrona corre no thread pool do
// libuv, sem bloquear o resto da app.
// Wrapper manual em vez de promisify(): o promisify infere `unknown` a partir
// do último overload de scrypt. Aqui o tipo de retorno é explícito (Buffer).
const scrypt = (
  password: string,
  salt: string,
  keylen: number,
): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey);
    });
  });

// Gestao de API Keys (para Postman/scripts externos) e a validacao feita em
// cada pedido autenticado por x-api-key.
//
// Cache (S-09): o agente faz poll e cada pedido pagava um scrypt e uma
// leitura na BD. Uma key valida fica em memoria API_KEY_CACHE_TTL_MS,
// indexada por um HMAC-SHA256 da raw key (rapido, sem scrypt). So entram
// keys validas: uma key invalida nunca fica em cache positiva. Ban/suspensao
// continua imediato porque a ApiKeyStrategy consulta o AccountStatusService
// em cada pedido, com ou sem cache. Revogar invalida logo nesta instancia;
// o TTL curto cobre o resto (conta apagada, mudanca de role, outra instancia,
// ver S-34). As falhas por IP vivem em api-key-failure.tracker.ts.
@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly cache = new Map<string, CachedApiKey>();
  // Sobe a cada revoke: uma validacao que leu a BD antes do revoke nao pode
  // voltar a meter a key revogada na cache depois de ele a limpar.
  private cacheEpoch = 0;

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
    const rawToken = randomBytes(RAW_KEY_BYTES).toString('base64url');

    // Usamos o secret do servidor como "salt" para manter a segurança do ambiente.
    // Sem fallback: se faltar em produção, é preferível a app não arrancar
    // (ver validação em main.ts) do que assinar API Keys com um segredo
    // público e previsível.
    const secret = this.requireApiKeySecret();

    const keyHash = (await scrypt(rawToken, secret, KEY_HASH_BYTES)).toString(
      'hex',
    );

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
    const cacheKey = createHmac('sha256', secret)
      .update(incomingToken)
      .digest('hex');

    const cached = this.readCache(cacheKey);
    if (cached) {
      this.touchLastUsed(cached);
      return { user: cached.user, scope: cached.scope };
    }

    const epoch = this.cacheEpoch;
    // Repetimos o mesmo cálculo (agora assíncrono) para verificar
    const keyHash = (
      await scrypt(incomingToken, secret, KEY_HASH_BYTES)
    ).toString('hex');

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKeyRecord) {
      this.logger.warn('Tentativa falhada de uso de API Key.');
      return null;
    }

    const entry: CachedApiKey = {
      keyId: apiKeyRecord.id,
      user: apiKeyRecord.user,
      scope: apiKeyRecord.scope,
      expiresAt: Date.now() + API_KEY_CACHE_TTL_MS,
      lastUsedAt: apiKeyRecord.lastUsed?.getTime() ?? null,
    };
    this.touchLastUsed(entry);
    if (epoch === this.cacheEpoch) this.writeCache(cacheKey, entry);
    return { user: entry.user, scope: entry.scope };
  }

  // lastUsed e so informativo (lista de keys): uma escrita a cada
  // API_KEY_LAST_USED_DEBOUNCE_MS chega, em vez de uma por pedido.
  private touchLastUsed(entry: CachedApiKey): void {
    const now = Date.now();
    if (
      entry.lastUsedAt !== null &&
      now - entry.lastUsedAt < API_KEY_LAST_USED_DEBOUNCE_MS
    ) {
      return;
    }
    entry.lastUsedAt = now;
    // updateMany: a key pode ter sido revogada entretanto (0 linhas, sem erro).
    this.prisma.apiKey
      .updateMany({
        where: { id: entry.keyId },
        data: { lastUsed: new Date(now) },
      })
      .catch((e: unknown) =>
        this.logger.error(
          'Erro ao atualizar lastUsed da API Key',
          e instanceof Error ? e.message : String(e),
        ),
      );
  }

  // LRU simples: o Map guarda a ordem de insercao, por isso reinserir no
  // hit poe a entrada no fim e a primeira e sempre a menos usada.
  private readCache(cacheKey: string): CachedApiKey | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;
    this.cache.delete(cacheKey);
    if (entry.expiresAt <= Date.now()) return null;
    this.cache.set(cacheKey, entry);
    return entry;
  }

  private writeCache(cacheKey: string, entry: CachedApiKey): void {
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);
    for (const oldest of this.cache.keys()) {
      if (this.cache.size <= API_KEY_CACHE_MAX_ENTRIES) return;
      this.cache.delete(oldest);
    }
  }

  private invalidateKey(keyId: string): void {
    this.cacheEpoch += 1;
    for (const [cacheKey, entry] of this.cache) {
      if (entry.keyId === keyId) this.cache.delete(cacheKey);
    }
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
    // Imediato: a cache nao pode deixar a key viva nem mais um pedido.
    this.invalidateKey(keyId);
    this.logger.log(`API Key revogada. KeyID: ${keyId}`);
  }
}
