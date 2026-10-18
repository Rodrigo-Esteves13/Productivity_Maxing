import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SocialService } from './social.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';

type Mock = jest.Mock;
interface PrismaMock {
  user: { findUnique: Mock; update: Mock };
  friendship: {
    findFirst: Mock;
    count: Mock;
    create: Mock;
    updateMany: Mock;
    deleteMany: Mock;
    findMany: Mock;
  };
  userBlock: {
    findFirst: Mock;
    findMany: Mock;
    upsert: Mock;
    deleteMany: Mock;
  };
  $transaction: Mock;
}

const build = (): { svc: SocialService; db: PrismaMock } => {
  const db: PrismaMock = {
    user: { findUnique: jest.fn(), update: jest.fn() },
    friendship: {
      findFirst: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    userBlock: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  return {
    svc: new SocialService(
      db as unknown as PrismaService,
      { notifyUser: jest.fn() } as unknown as PushService,
    ),
    db,
  };
};

describe('SocialService', () => {
  it('unknown code and banned user look the same (404)', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue(null);
    await expect(svc.sendRequest('me', 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    db.user.findUnique.mockResolvedValue({ id: 'x', status: 'BANNED' });
    await expect(svc.sendRequest('me', 'code')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('a block in either direction hides the user (404)', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue({ id: 'x', status: 'ACTIVE' });
    db.userBlock.findFirst.mockResolvedValue({ blockerId: 'x' });
    await expect(svc.sendRequest('me', 'code')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(db.friendship.create).not.toHaveBeenCalled();
  });

  it('cannot add yourself', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue({ id: 'me', status: 'ACTIVE' });
    await expect(svc.sendRequest('me', 'code')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('creates a pending request', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue({ id: 'x', status: 'ACTIVE' });
    db.userBlock.findFirst.mockResolvedValue(null);
    db.friendship.findFirst.mockResolvedValue(null);
    await expect(svc.sendRequest('me', 'code')).resolves.toEqual({
      status: 'PENDING',
    });
    expect(db.friendship.create).toHaveBeenCalledWith({
      data: { requesterId: 'me', addresseeId: 'x' },
    });
  });

  it('requesting someone who already asked you accepts', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue({ id: 'x', status: 'ACTIVE' });
    db.userBlock.findFirst.mockResolvedValue(null);
    db.friendship.findFirst.mockResolvedValue({
      id: 'f1',
      requesterId: 'x',
      addresseeId: 'me',
      status: 'PENDING',
    });
    db.friendship.updateMany.mockResolvedValue({ count: 1 });
    await expect(svc.sendRequest('me', 'code')).resolves.toEqual({
      status: 'ACCEPTED',
    });
  });

  it('only the addressee can accept', async () => {
    const { svc, db } = build();
    db.friendship.updateMany.mockResolvedValue({ count: 0 });
    await expect(svc.accept('me', 'f1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const args = (
      db.friendship.updateMany.mock.calls as [{ where: unknown }][]
    )[0][0];
    expect(args.where).toEqual({
      id: 'f1',
      addresseeId: 'me',
      status: 'PENDING',
    });
  });

  it('remove only touches your own friendships', async () => {
    const { svc, db } = build();
    db.friendship.deleteMany.mockResolvedValue({ count: 0 });
    await expect(svc.remove('me', 'f1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('blocking removes the friendship and records the block atomically', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue({ id: 'x' });
    await svc.block('me', 'x');
    expect(db.$transaction).toHaveBeenCalled();
  });
});
