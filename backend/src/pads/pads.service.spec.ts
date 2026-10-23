import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PadsService } from './pads.service';
import { PAD_ANON_MAX_CONTENT_LENGTH, PAD_EXPIRY_MS } from './pads.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { SecurityLogsService } from '../security-logs/security-logs.service';

const ACCOUNT = { userId: 'u1', ipHash: null };
const ANON = { userId: null, ipHash: 'hash-1' };
const updatedAt = new Date('2026-10-23T10:00:00Z');

const setup = () => {
  const prisma = {
    pad: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    padBlockedSource: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn(),
    },
  };
  const securityLogs = { recordEvent: jest.fn() };
  const service = new PadsService(
    prisma as unknown as PrismaService,
    securityLogs as unknown as SecurityLogsService,
  );
  return { service, prisma, securityLogs };
};

const row = (overrides: Record<string, unknown> = {}) => ({
  slug: 'fisica',
  content: 'new',
  version: 3,
  updatedAt,
  lockedById: null,
  ...overrides,
});

describe('PadsService', () => {
  it('reads a pad that was never saved as empty, version 0', async () => {
    const { service } = setup();
    await expect(service.get('fisica', ANON)).resolves.toMatchObject({
      slug: 'fisica',
      content: '',
      version: 0,
      locked: false,
      maxLength: PAD_ANON_MAX_CONTENT_LENGTH,
    });
  });

  it('accounts have no extra length limit beyond the DTO', async () => {
    const { service } = setup();
    await expect(service.get('fisica', ACCOUNT)).resolves.toMatchObject({
      maxLength: null,
    });
  });

  it('saves on top of the version the client had, skipping pads locked by others', async () => {
    const { service, prisma } = setup();
    prisma.pad.updateMany.mockResolvedValue({ count: 1 });
    prisma.pad.findUnique.mockResolvedValue(row());
    const saved = await service.save(ACCOUNT, 'fisica', {
      content: 'new',
      baseVersion: 2,
    });
    expect(prisma.pad.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          slug: 'fisica',
          version: 2,
          OR: [{ lockedById: null }, { lockedById: 'u1' }],
        },
      }),
    );
    expect(saved.version).toBe(3);
  });

  it('anonymous saves keep only the IP hash, never an account', async () => {
    const { service, prisma } = setup();
    prisma.pad.updateMany.mockResolvedValue({ count: 1 });
    prisma.pad.findUnique.mockResolvedValue(row());
    await service.save(ANON, 'fisica', { content: 'x', baseVersion: 2 });
    const [[args]] = prisma.pad.updateMany.mock.calls as [
      [{ where: unknown; data: Record<string, unknown> }],
    ];
    expect(args.where).toEqual({
      slug: 'fisica',
      version: 2,
      lockedById: null,
    });
    expect(args.data.updatedById).toBeNull();
    expect(args.data.updatedByIpHash).toBe('hash-1');
  });

  it('a blocked anonymous source cannot save', async () => {
    const { service, prisma } = setup();
    prisma.padBlockedSource.findUnique.mockResolvedValue({ ipHash: 'hash-1' });
    await expect(
      service.save(ANON, 'fisica', { content: 'spam', baseVersion: 0 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pad.create).not.toHaveBeenCalled();
  });

  it('refuses anonymous text over the smaller limit', async () => {
    const { service, prisma } = setup();
    await expect(
      service.save(ANON, 'fisica', {
        content: 'a'.repeat(PAD_ANON_MAX_CONTENT_LENGTH + 1),
        baseVersion: 0,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.pad.create).not.toHaveBeenCalled();
  });

  it('returns 409 when someone saved first', async () => {
    const { service, prisma } = setup();
    prisma.pad.findUnique.mockResolvedValue(row());
    await expect(
      service.save(ACCOUNT, 'fisica', { content: 'mine', baseVersion: 2 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns 403 when the pad is locked by another account', async () => {
    const { service, prisma } = setup();
    prisma.pad.findUnique.mockResolvedValue(row({ lockedById: 'u2' }));
    await expect(
      service.save(ANON, 'fisica', { content: 'mine', baseVersion: 3 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns 409 when two people create the same pad at once', async () => {
    const { service, prisma } = setup();
    prisma.pad.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    prisma.pad.findUnique.mockResolvedValue(row());
    await expect(
      service.save(ACCOUNT, 'fisica', { content: 'mine', baseVersion: 0 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('PadsService locking', () => {
  it('cannot lock a pad someone else locked', async () => {
    const { service, prisma } = setup();
    prisma.pad.findUnique.mockResolvedValue(row({ lockedById: 'u2' }));
    await expect(service.lock('u1', 'fisica')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('only the locker unlocks, unless it is an admin', async () => {
    const { service, prisma } = setup();
    await expect(service.unlock('u1', 'fisica', false)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.pad.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: 'fisica', lockedById: 'u1' } }),
    );
  });
});

describe('PadsService expiry', () => {
  it('deletes only unlocked pads not edited within the expiry window', async () => {
    const { service, prisma } = setup();
    const now = new Date('2026-10-23T00:00:00Z');
    await service.deleteExpired(now);
    expect(prisma.pad.deleteMany).toHaveBeenCalledWith({
      where: {
        lockedById: null,
        updatedAt: { lt: new Date(now.getTime() - PAD_EXPIRY_MS) },
      },
    });
  });
});

describe('PadsService moderation', () => {
  it('logs the deletion with the admin and request details', async () => {
    const { service, prisma, securityLogs } = setup();
    prisma.pad.deleteMany.mockResolvedValue({ count: 1 });
    await service.removeAsAdmin('fisica', {
      adminId: 'admin1',
      ip: '1.2.3.4',
      method: 'DELETE',
      path: '/pads/fisica',
    });
    expect(securityLogs.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ADMIN_PAD_DELETED',
        userId: 'admin1',
        ip: '1.2.3.4',
      }),
    );
  });

  it('a pad that does not exist is a 404 and logs nothing', async () => {
    const { service, securityLogs } = setup();
    await expect(
      service.removeAsAdmin('nada', {
        adminId: 'admin1',
        ip: '',
        method: 'DELETE',
        path: '/pads/nada',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(securityLogs.recordEvent).not.toHaveBeenCalled();
  });
});
