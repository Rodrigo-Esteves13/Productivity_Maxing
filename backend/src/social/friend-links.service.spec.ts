import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FriendLinksService } from './friend-links.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { SocialService } from './social.service';

const OWNER = { id: 'owner', name: 'Ana', avatarUrl: null, status: 'ACTIVE' };

function setup() {
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { friendCode?: string } }) =>
          Promise.resolve(
            where.friendCode === 'CODE'
              ? OWNER
              : { name: 'Rui', email: 'r@x.test' },
          ),
        ),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    userBlock: { count: jest.fn().mockResolvedValue(0) },
    friendship: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const social = {
    ensureFriendCode: jest.fn().mockResolvedValue('CODE'),
    sendRequest: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    requestToUser: jest.fn().mockResolvedValue({ status: 'PENDING' }),
    assertCanSendRequests: jest.fn().mockResolvedValue(undefined),
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new FriendLinksService(
    prisma as unknown as PrismaService,
    social as unknown as SocialService,
    push as unknown as PushService,
  );
  return { service, prisma, social, push };
}

describe('FriendLinksService', () => {
  const OLD_SECRET = process.env.JWT_SECRET;
  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
  });
  afterAll(() => {
    process.env.JWT_SECRET = OLD_SECRET;
  });

  it('a signed link makes both friends at once and tells the owner', async () => {
    const { service, prisma, social, push } = setup();
    const link = await service.create('owner');
    const result = await service.accept(
      'me',
      link.code,
      link.expires,
      link.token,
    );
    expect(result).toEqual({ status: 'ACCEPTED' });
    expect(prisma.friendship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requesterId: 'owner',
        addresseeId: 'me',
        status: 'ACCEPTED',
      }) as unknown,
    });
    expect(social.sendRequest).not.toHaveBeenCalled();
    expect(push.notifyUser).toHaveBeenCalledWith(
      'owner',
      'friendLinkJoined',
      expect.anything(),
    );
  });

  it('a tampered or expired link is only a normal request', async () => {
    const { service, prisma, social } = setup();
    const link = await service.create('owner');
    await service.accept('me', link.code, link.expires, 'x'.repeat(32));
    await service.accept('me', link.code, Date.now() - 1000, link.token);
    expect(social.sendRequest).toHaveBeenCalledTimes(2);
    expect(prisma.friendship.create).not.toHaveBeenCalled();
  });

  it('cannot accept your own link', async () => {
    const { service } = setup();
    const link = await service.create('owner');
    await expect(
      service.accept('owner', link.code, link.expires, link.token),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a block hides the link', async () => {
    const { service, prisma } = setup();
    prisma.userBlock.count.mockResolvedValue(1);
    await expect(service.preview('me', 'CODE')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('email requests answer the same whether the account exists or not', async () => {
    const { service, prisma, social } = setup();
    await expect(
      service.requestByEmail('me', 'nobody@x.test'),
    ).resolves.toEqual({ status: 'SENT' });
    expect(social.requestToUser).not.toHaveBeenCalled();

    prisma.user.findFirst.mockResolvedValue({ id: 'other' });
    await expect(service.requestByEmail('me', 'Other@X.test')).resolves.toEqual(
      { status: 'SENT' },
    );
    expect(social.requestToUser).toHaveBeenCalledWith('me', 'other');
    // Procura sem distinguir maiusculas e so quem aceita pedidos por email.
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { equals: 'Other@X.test', mode: 'insensitive' },
          allowEmailFriendRequests: true,
        }) as unknown,
      }),
    );

    social.requestToUser.mockRejectedValue(new NotFoundException());
    await expect(service.requestByEmail('me', 'other@x.test')).resolves.toEqual(
      { status: 'SENT' },
    );
  });
  it('own limits fail the same way for any email, so a 400 never reveals an account', async () => {
    const { service, prisma, social } = setup();
    social.assertCanSendRequests.mockRejectedValue(
      new BadRequestException('Too many pending requests.'),
    );
    await expect(
      service.requestByEmail('me', 'nobody@x.test'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();

    // Limite atingido entre a verificacao e o pedido: continua "enviado".
    social.assertCanSendRequests.mockResolvedValue(undefined);
    prisma.user.findFirst.mockResolvedValue({ id: 'other' });
    social.requestToUser.mockRejectedValue(new BadRequestException());
    await expect(service.requestByEmail('me', 'other@x.test')).resolves.toEqual(
      { status: 'SENT' },
    );
  });
});
