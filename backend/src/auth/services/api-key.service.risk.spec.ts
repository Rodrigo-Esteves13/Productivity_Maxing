import { ApiKeyService } from './api-key.service';
import type { PrismaService } from '../../prisma/prisma.service';
const contains = (o: object): unknown => expect.objectContaining(o);

const START = 20_000_000;

function setup() {
  const prisma = {
    apiKey: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
  const service = new ApiKeyService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('ApiKeyService risk', () => {
  const env = { ...process.env };

  beforeAll(() => {
    process.env.API_KEY_SECRET = 'test-api-key-secret';
  });

  afterAll(() => {
    process.env = env;
  });

  describe('scope on generate', () => {
    it('ADMIN scope only for an ADMIN requester', async () => {
      const { service, prisma } = setup();
      await service.generateApiKey('a1', 'ci', 'ADMIN', 'ADMIN');
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: contains({ userId: 'a1', scope: 'ADMIN' }),
      });
    });

    it.each(['USER', 'MODERATOR'] as const)(
      'downgrades an ADMIN request from a %s to TASKS',
      async (role) => {
        const { service, prisma } = setup();
        await service.generateApiKey('u1', 'ci', 'ADMIN', role as never);
        expect(prisma.apiKey.create).toHaveBeenCalledWith({
          data: contains({ scope: 'TASKS' }),
        });
      },
    );

    it('keeps TASKS for an admin asking for TASKS', async () => {
      const { service, prisma } = setup();
      await service.generateApiKey('a1', 'ci', 'TASKS', 'ADMIN');
      expect(prisma.apiKey.create).toHaveBeenCalledWith({
        data: contains({ scope: 'TASKS' }),
      });
    });

    it('stores only a hash, never the raw key', async () => {
      const { service, prisma } = setup();
      const { apiKey } = await service.generateApiKey(
        'u1',
        'ci',
        'TASKS',
        'USER',
      );
      const data = (
        prisma.apiKey.create.mock.calls[0] as [{ data: { keyHash: string } }]
      )[0].data;
      expect(data.keyHash).toMatch(/^[0-9a-f]{128}$/);
      expect(data.keyHash).not.toContain(apiKey);
      expect(apiKey.length).toBeGreaterThanOrEqual(43);
    });

    it('fails loud without API_KEY_SECRET', async () => {
      const { service } = setup();
      const saved = process.env.API_KEY_SECRET;
      delete process.env.API_KEY_SECRET;
      try {
        await expect(
          service.generateApiKey('u1', 'ci', 'TASKS', 'USER'),
        ).rejects.toThrow('API_KEY_SECRET is not defined');
        await expect(service.validateApiKey('t')).rejects.toThrow(
          'API_KEY_SECRET is not defined',
        );
      } finally {
        process.env.API_KEY_SECRET = saved;
      }
    });
  });

  describe('revoke', () => {
    it('deletes scoped by owner: another user key id cannot be removed', async () => {
      const { service, prisma } = setup();
      // Prisma real: 0 linhas para (id, userId) -> P2025 -> 404 no filtro global.
      prisma.apiKey.delete.mockRejectedValue({ code: 'P2025' });
      await expect(
        service.revokeApiKey('attacker', 'victim-key'),
      ).rejects.toMatchObject({ code: 'P2025' });
      expect(prisma.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'victim-key', userId: 'attacker' },
      });
    });

    it('a failed revoke does not evict the cache of the real owner', async () => {
      const { service, prisma } = setup();
      const now = jest.spyOn(Date, 'now').mockReturnValue(START);
      try {
        const real = jest.requireActual<typeof import('crypto')>('crypto');
        const hash = real
          .scryptSync('tok', process.env.API_KEY_SECRET as string, 64)
          .toString('hex');
        const record = {
          id: 'k1',
          scope: 'TASKS',
          lastUsed: new Date(START),
          user: { id: 'owner' },
        };
        prisma.apiKey.findUnique.mockImplementation(
          ({ where }: { where: { keyHash: string } }) =>
            Promise.resolve(where.keyHash === hash ? record : null),
        );
        await service.validateApiKey('tok');
        prisma.apiKey.delete.mockRejectedValue({ code: 'P2025' });
        await expect(
          service.revokeApiKey('attacker', 'k1'),
        ).rejects.toBeTruthy();

        prisma.apiKey.findUnique.mockClear();
        await service.validateApiKey('tok');
        expect(prisma.apiKey.findUnique).not.toHaveBeenCalled();
      } finally {
        now.mockRestore();
      }
    });
  });

  describe('listApiKeys', () => {
    it('is scoped to the user and never selects keyHash', async () => {
      const { service, prisma } = setup();
      await service.listApiKeys('u1');
      const arg = (
        prisma.apiKey.findMany.mock.calls[0] as [
          { where: object; select: Record<string, boolean> },
        ]
      )[0];
      expect(arg.where).toEqual({ userId: 'u1' });
      expect(arg.select.keyHash).toBeUndefined();
    });
  });
});
