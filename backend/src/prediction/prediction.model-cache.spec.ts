import { PredictionService } from './prediction.service';
import { PREDICTION_MODEL_CACHE_MAX_USERS } from './prediction.constants';
import type { PrismaService } from '../prisma/prisma.service';

// Cache dos modelos treinados: LRU com teto (antes um Map sem limite).
type CacheAccess = {
  modelCache: Map<string, unknown>;
  readCachedModel(userId: string): unknown;
  writeCachedModel(userId: string, model: unknown): void;
};

function cacheOf(): CacheAccess {
  const service = new PredictionService({} as PrismaService);
  return service as unknown as CacheAccess;
}

describe('PredictionService model cache', () => {
  it('never holds more than PREDICTION_MODEL_CACHE_MAX_USERS models', () => {
    const cache = cacheOf();
    for (let i = 0; i <= PREDICTION_MODEL_CACHE_MAX_USERS; i += 1) {
      cache.writeCachedModel(`u${i}`, { i });
    }
    expect(cache.modelCache.size).toBe(PREDICTION_MODEL_CACHE_MAX_USERS);
    // O primeiro (menos usado) saiu; o ultimo ficou.
    expect(cache.readCachedModel('u0')).toBeUndefined();
    expect(
      cache.readCachedModel(`u${PREDICTION_MODEL_CACHE_MAX_USERS}`),
    ).toEqual({ i: PREDICTION_MODEL_CACHE_MAX_USERS });
  });

  it('a read refreshes the user, so the least recently used one is evicted', () => {
    const cache = cacheOf();
    for (let i = 0; i < PREDICTION_MODEL_CACHE_MAX_USERS; i += 1) {
      cache.writeCachedModel(`u${i}`, { i });
    }
    expect(cache.readCachedModel('u0')).toEqual({ i: 0 });
    cache.writeCachedModel('novo', { i: -1 });
    expect(cache.readCachedModel('u0')).toEqual({ i: 0 });
    expect(cache.readCachedModel('u1')).toBeUndefined();
  });
});
