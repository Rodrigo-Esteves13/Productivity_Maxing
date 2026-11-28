import * as crypto from 'crypto';
import { ApiKeyService } from './api-key.service';
import type { PrismaService } from '../../prisma/prisma.service';
import {
  API_KEY_CACHE_MAX_ENTRIES,
  API_KEY_CACHE_TTL_MS,
  API_KEY_LAST_USED_DEBOUNCE_MS,
} from '../dto/auth-limits';

// scrypt real, mas espiado: o cache hit nao o pode chamar.
jest.mock('crypto', () => {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return { ...actual, scrypt: jest.fn(actual.scrypt) };
});
const scryptMock = crypto.scrypt as unknown as jest.Mock;

const USER = { id: 'user-1', email: 'u@example.test', role: 'USER' };
const VALID_TOKEN = 'valid-token';
const KEY_ID = 'key-1';
const START = 10_000_000;

function setup(lastUsed: Date | null = null) {
  const record: {
    id: string;
    scope: string;
    lastUsed: Date | null;
    user: typeof USER;
  } = { id: KEY_ID, scope: 'TASKS', lastUsed, user: USER };
  const prisma = {
    apiKey: {
      // So a key "valida" existe: o mock compara o hash com o do token certo.
      findUnique: jest.fn(),
      // Como a BD real: a proxima leitura ja ve o lastUsed escrito.
      updateMany: jest
        .fn()
        .mockImplementation(({ data }: { data: { lastUsed: Date } }) => {
          record.lastUsed = data.lastUsed;
          return Promise.resolve({ count: 1 });
        }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new ApiKeyService(prisma as unknown as PrismaService);
  return { service, prisma, record };
}

function hashOf(token: string): string {
  const actual = jest.requireActual<typeof import('crypto')>('crypto');
  return actual
    .scryptSync(token, process.env.API_KEY_SECRET as string, 64)
    .toString('hex');
}

describe('ApiKeyService.validateApiKey cache (S-09)', () => {
  let now: jest.SpyInstance<number, []>;
  let validHash: string;

  beforeAll(() => {
    process.env.API_KEY_SECRET = 'test-api-key-secret';
    validHash = hashOf(VALID_TOKEN);
  });

  beforeEach(() => {
    scryptMock.mockClear();
    now = jest.spyOn(Date, 'now').mockReturnValue(START);
  });

  afterEach(() => now.mockRestore());

  function wire(s: ReturnType<typeof setup>) {
    s.prisma.apiKey.findUnique.mockImplementation(
      ({ where }: { where: { keyHash: string } }) =>
        Promise.resolve(where.keyHash === validHash ? s.record : null),
    );
    return s;
  }

  it('serves a repeated valid key from cache, without scrypt or a DB read', async () => {
    const { service, prisma } = wire(setup());
    await expect(service.validateApiKey(VALID_TOKEN)).resolves.toMatchObject({
      user: USER,
      scope: 'TASKS',
    });
    await expect(service.validateApiKey(VALID_TOKEN)).resolves.toMatchObject({
      user: USER,
    });
    expect(scryptMock).toHaveBeenCalledTimes(1);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(1);
  });

  it('goes back to scrypt and the DB once the TTL expires', async () => {
    const { service, prisma } = wire(setup());
    await service.validateApiKey(VALID_TOKEN);
    now.mockReturnValue(START + API_KEY_CACHE_TTL_MS);
    await service.validateApiKey(VALID_TOKEN);
    expect(scryptMock).toHaveBeenCalledTimes(2);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(2);
  });

  it('never caches an invalid key as valid', async () => {
    const { service, prisma } = wire(setup());
    await expect(service.validateApiKey('wrong-token')).resolves.toBeNull();
    await expect(service.validateApiKey('wrong-token')).resolves.toBeNull();
    expect(scryptMock).toHaveBeenCalledTimes(2);
    expect(prisma.apiKey.findUnique).toHaveBeenCalledTimes(2);
  });

  it('revoke invalidates the cached key immediately', async () => {
    const { service, prisma } = wire(setup());
    await service.validateApiKey(VALID_TOKEN);
    prisma.apiKey.findUnique.mockResolvedValue(null);

    await service.revokeApiKey(USER.id, KEY_ID);

    expect(prisma.apiKey.delete).toHaveBeenCalledWith({
      where: { id: KEY_ID, userId: USER.id },
    });
    await expect(service.validateApiKey(VALID_TOKEN)).resolves.toBeNull();
  });

  it('a lookup that started before the revoke does not re-cache the key', async () => {
    const s = setup();
    let release!: (v: unknown) => void;
    s.prisma.apiKey.findUnique.mockReturnValueOnce(
      new Promise((resolve) => (release = resolve)),
    );
    const inFlight = s.service.validateApiKey(VALID_TOKEN);
    // Espera o scrypt acabar e a leitura na BD ficar pendurada.
    await new Promise((resolve) => setImmediate(resolve));
    while (s.prisma.apiKey.findUnique.mock.calls.length === 0) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    await s.service.revokeApiKey(USER.id, KEY_ID);
    release(s.record);
    await inFlight;

    s.prisma.apiKey.findUnique.mockResolvedValue(null);
    await expect(s.service.validateApiKey(VALID_TOKEN)).resolves.toBeNull();
  });

  it('writes lastUsed at most once per debounce window', async () => {
    const { service, prisma } = wire(setup());
    await service.validateApiKey(VALID_TOKEN);
    await service.validateApiKey(VALID_TOKEN);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(1);

    now.mockReturnValue(START + API_KEY_LAST_USED_DEBOUNCE_MS - 1);
    await service.validateApiKey(VALID_TOKEN);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(1);

    now.mockReturnValue(START + API_KEY_LAST_USED_DEBOUNCE_MS);
    await service.validateApiKey(VALID_TOKEN);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.apiKey.updateMany).toHaveBeenLastCalledWith({
      where: { id: KEY_ID },
      data: { lastUsed: new Date(START + API_KEY_LAST_USED_DEBOUNCE_MS) },
    });
  });

  it('skips the lastUsed write when the DB value is recent', async () => {
    const { service, prisma } = wire(setup(new Date(START - 1)));
    await service.validateApiKey(VALID_TOKEN);
    expect(prisma.apiKey.updateMany).not.toHaveBeenCalled();
  });

  it('never keeps the raw key in memory (cache keyed by a derived value)', async () => {
    const { service } = wire(setup());
    await service.validateApiKey(VALID_TOKEN);
    const cache = (service as unknown as { cache: Map<string, unknown> }).cache;
    expect(cache.size).toBe(1);
    const [cacheKey] = [...cache.keys()];
    expect(cacheKey).not.toContain(VALID_TOKEN);
    expect(JSON.stringify([...cache.values()])).not.toContain(VALID_TOKEN);
  });

  it('two instances derive different cache keys for the same raw key', async () => {
    const a = wire(setup());
    const b = wire(setup());
    await a.service.validateApiKey(VALID_TOKEN);
    await b.service.validateApiKey(VALID_TOKEN);
    const keyOf = (s: ApiKeyService) => [
      ...(s as unknown as { cache: Map<string, unknown> }).cache.keys(),
    ];
    expect(keyOf(a.service)).not.toEqual(keyOf(b.service));
  });

  it('a write prunes expired entries of other keys', async () => {
    const { service, prisma } = setup();
    prisma.apiKey.findUnique.mockImplementation(
      ({ where }: { where: { keyHash: string } }) =>
        Promise.resolve({
          id: `key-${where.keyHash.slice(0, 8)}`,
          scope: 'TASKS',
          lastUsed: new Date(START),
          user: USER,
        }),
    );
    await service.validateApiKey('token-a');
    await service.validateApiKey('token-b');
    expect(service.cachedKeys).toBe(2);

    now.mockReturnValue(START + API_KEY_CACHE_TTL_MS);
    await service.validateApiKey('token-c');
    // token-a e token-b expiraram e sairam sem ninguem os voltar a ler.
    expect(service.cachedKeys).toBe(1);
  });

  it('keeps the cache bounded, evicting the least recently used key', async () => {
    const { service, prisma } = setup();
    prisma.apiKey.findUnique.mockImplementation(
      ({ where }: { where: { keyHash: string } }) =>
        Promise.resolve({
          id: `key-${where.keyHash}`,
          scope: 'TASKS',
          lastUsed: new Date(START),
          user: USER,
        }),
    );
    scryptMock.mockImplementation(
      (
        password: string,
        _salt: string,
        _len: number,
        cb: (err: Error | null, key: Buffer) => void,
      ) => cb(null, Buffer.from(password)),
    );
    try {
      for (let i = 0; i <= API_KEY_CACHE_MAX_ENTRIES; i += 1) {
        await service.validateApiKey(`token-${i}`);
      }
      const reads = prisma.apiKey.findUnique.mock.calls.length;
      // A ultima continua em cache; a primeira foi despejada.
      await service.validateApiKey(`token-${API_KEY_CACHE_MAX_ENTRIES}`);
      expect(prisma.apiKey.findUnique.mock.calls.length).toBe(reads);
      await service.validateApiKey('token-0');
      expect(prisma.apiKey.findUnique.mock.calls.length).toBe(reads + 1);
    } finally {
      const actual = jest.requireActual<typeof import('crypto')>('crypto');
      scryptMock.mockImplementation(actual.scrypt);
    }
  });
});

describe('ApiKeyService cache sweep', () => {
  beforeAll(() => {
    process.env.API_KEY_SECRET = 'test-api-key-secret';
  });

  afterEach(() => jest.useRealTimers());

  it('the periodic sweep removes expired entries without any further request', async () => {
    const { service, prisma, record } = setup(new Date());
    prisma.apiKey.findUnique.mockResolvedValue(record);
    await service.validateApiKey(VALID_TOKEN);
    expect(service.cachedKeys).toBe(1);

    jest.useFakeTimers();
    service.onModuleInit();
    jest.advanceTimersByTime(API_KEY_CACHE_TTL_MS);
    expect(service.cachedKeys).toBe(0);
    service.onModuleDestroy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('the sweep timer does not keep the process alive and stops on destroy', () => {
    const { service } = setup();
    const unref = jest.fn();
    const handle = { unref } as unknown as NodeJS.Timeout;
    const setSpy = jest.spyOn(global, 'setInterval').mockReturnValue(handle);
    const clearSpy = jest.spyOn(global, 'clearInterval').mockImplementation();
    try {
      service.onModuleInit();
      expect(unref).toHaveBeenCalledTimes(1);
      service.onModuleDestroy();
      expect(clearSpy).toHaveBeenCalledWith(handle);
    } finally {
      setSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });
});
