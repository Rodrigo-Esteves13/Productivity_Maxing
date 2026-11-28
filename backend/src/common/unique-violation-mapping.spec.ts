// B-23 (sessao ativa unica) e B-31 (nome de Area oficial unico): a corrida
// que o findFirst nao apanha chega como P2002 e vira 409.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({})),
}));
import { ConflictException } from '@nestjs/common';
import { StudySessionsService } from '../study-sessions/study-sessions.service';
import { AreasService } from '../areas/areas.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';

const p2002 = Object.assign(new Error('Unique constraint failed'), {
  code: 'P2002',
});

describe('StudySessionsService.start (B-23)', () => {
  function setup() {
    const prisma = {
      studySession: {
        findFirst: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockRejectedValue(p2002),
      },
    };
    return {
      prisma,
      service: new StudySessionsService(prisma as unknown as PrismaService),
    };
  }

  it('turns a P2002 from the partial unique index into the 409', async () => {
    const { service } = setup();
    await expect(service.start('u1', {})).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rethrows other errors untouched', async () => {
    const { prisma, service } = setup();
    const boom = new Error('db down');
    prisma.studySession.create.mockRejectedValue(boom);
    await expect(service.start('u1', {})).rejects.toBe(boom);
  });
});

describe('AreasService official name uniqueness (B-31)', () => {
  const admin = { id: 'admin', role: 'ADMIN' } as AuthenticatedUser;

  it('createOfficial maps P2002 to 409', async () => {
    const prisma = {
      area: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(p2002),
      },
      taskType: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new AreasService(prisma as unknown as PrismaService);
    await expect(
      service.createOfficial(admin.id, { name: 'Calculo' } as never),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('approve maps P2002 to 409', async () => {
    const prisma = {
      area: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({ id: 'a1', name: 'Calculo', ownerId: 'u1' })
          .mockResolvedValue(null),
        updateMany: jest.fn().mockRejectedValue(p2002),
      },
    };
    const service = new AreasService(prisma as unknown as PrismaService);
    await expect(service.approve(admin.id, 'a1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
