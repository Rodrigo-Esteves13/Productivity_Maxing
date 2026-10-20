import { NotFoundException } from '@nestjs/common';
import { AdminSocialService } from './admin-social.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SocialService } from './social.service';

const person = (id: string, name: string) => ({
  id,
  name,
  email: `${id}@x.test`,
  avatarUrl: null,
  status: 'ACTIVE' as const,
});

const ANA = person('ana', 'Ana');
const BRUNO = person('bruno', 'Bruno');
const CARLA = person('carla', 'Carla');
const DIANA = person('diana', 'Diana');
const created = new Date('2026-10-01T10:00:00Z');

function build() {
  const db = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        ...ANA,
        role: 'USER',
        createdAt: created,
        friendCode: 'abc123',
      }),
    },
    friendship: {
      findMany: jest.fn().mockResolvedValue([
        {
          requesterId: 'ana',
          addresseeId: 'carla',
          status: 'ACCEPTED',
          createdAt: created,
          decidedAt: created,
          requester: ANA,
          addressee: CARLA,
        },
        {
          requesterId: 'bruno',
          addresseeId: 'ana',
          status: 'ACCEPTED',
          createdAt: created,
          decidedAt: null,
          requester: BRUNO,
          addressee: ANA,
        },
        {
          requesterId: 'diana',
          addresseeId: 'ana',
          status: 'PENDING',
          createdAt: created,
          decidedAt: null,
          requester: DIANA,
          addressee: ANA,
        },
      ]),
    },
    userBlock: {
      findMany: jest.fn().mockResolvedValue([
        {
          blockerId: 'diana',
          blockedId: 'ana',
          createdAt: created,
          blocker: DIANA,
          blocked: ANA,
        },
      ]),
    },
    notebookViewGrant: {
      findMany: jest.fn().mockResolvedValue([
        {
          ownerId: 'ana',
          viewerId: 'bruno',
          status: 'APPROVED',
          areaIds: ['a1', 'a2'],
          owner: ANA,
          viewer: BRUNO,
        },
      ]),
    },
    notebookShareAccessRequest: {
      findMany: jest.fn().mockResolvedValue([
        {
          accessRole: 'EDITOR',
          requestingUser: CARLA,
          notebookShare: { createdBy: ANA },
        },
        {
          accessRole: 'VIEWER',
          requestingUser: CARLA,
          notebookShare: { createdBy: ANA },
        },
        {
          accessRole: 'VIEWER',
          requestingUser: ANA,
          notebookShare: { createdBy: BRUNO },
        },
      ]),
    },
    friendCodeChangeRequest: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const social = {
    rotateFriendCode: jest.fn().mockResolvedValue('novo456'),
  };
  const svc = new AdminSocialService(
    db as unknown as PrismaService,
    social as unknown as SocialService,
  );
  return { svc, db, social };
}

describe('AdminSocialService', () => {
  it('separa amigos, pedidos, bloqueios e notas partilhadas da pessoa', async () => {
    const { svc } = build();
    const p = await svc.profile('ana');
    expect(p.friendCode).toBe('abc123');
    expect(p.user.email).toBe('ana@x.test');
    expect(p.friends.map((f) => f.userId)).toEqual(['bruno', 'carla']);
    expect(p.incoming.map((f) => f.userId)).toEqual(['diana']);
    expect(p.outgoing).toEqual([]);
    expect(p.blocked).toEqual([]);
    expect(p.blockedBy.map((b) => b.userId)).toEqual(['diana']);
    expect(p.readers).toEqual([
      expect.objectContaining({
        userId: 'bruno',
        grantStatus: 'APPROVED',
        areaCount: 2,
      }),
    ]);
    expect(p.reading).toEqual([]);
    expect(p.sharedWith).toEqual([
      expect.objectContaining({
        userId: 'carla',
        items: 2,
        roles: ['EDITOR', 'VIEWER'],
      }),
    ]);
    expect(p.sharedBy).toEqual([
      expect.objectContaining({ userId: 'bruno', items: 1 }),
    ]);
  });

  it('conta inexistente: 404', async () => {
    const { svc, db } = build();
    db.user.findUnique.mockResolvedValue(null);
    await expect(svc.profile('x')).rejects.toBeInstanceOf(NotFoundException);
    await expect(svc.regenerateFriendCode('admin', 'x')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('regenerar troca o codigo e resolve o pedido pendente da pessoa', async () => {
    const { svc, db, social } = build();
    await expect(svc.regenerateFriendCode('admin', 'ana')).resolves.toEqual({
      friendCode: 'novo456',
    });
    expect(social.rotateFriendCode).toHaveBeenCalledWith('ana');
    const [args] = db.friendCodeChangeRequest.updateMany.mock.calls[0] as [
      { where: unknown; data: { status: string; decidedById: string } },
    ];
    expect(args.where).toEqual({ userId: 'ana', status: 'PENDING' });
    expect(args.data.status).toBe('APPROVED');
    expect(args.data.decidedById).toBe('admin');
  });
});
