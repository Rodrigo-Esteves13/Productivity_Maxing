import { ConflictException, NotFoundException } from '@nestjs/common';
import { FriendCodeRequestsService } from './friend-code-requests.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { SocialService } from './social.service';

function setup(o: { pending?: boolean; recent?: number; claim?: number } = {}) {
  const prisma = {
    friendCodeChangeRequest: {
      findFirst: jest
        .fn()
        .mockResolvedValue(o.pending ? { id: 'r1', userId: 'u1' } : null),
      count: jest.fn().mockResolvedValue(o.recent ?? 0),
      create: jest.fn().mockResolvedValue({
        status: 'PENDING',
        adminNote: null,
        createdAt: new Date(),
      }),
      updateMany: jest.fn().mockResolvedValue({ count: o.claim ?? 1 }),
    },
  };
  const social = { rotateFriendCode: jest.fn().mockResolvedValue('new') };
  const service = new FriendCodeRequestsService(
    prisma as unknown as PrismaService,
    social as unknown as SocialService,
  );
  return { service, prisma, social };
}

describe('FriendCodeRequestsService', () => {
  it('cria um pedido pendente', async () => {
    const { service, prisma } = setup();
    const res = await service.create('u1', 'Recebi spam no meu codigo');
    expect(res.status).toBe('PENDING');
    expect(prisma.friendCodeChangeRequest.create).toHaveBeenCalled();
  });

  it('so um pedido pendente de cada vez', async () => {
    const { service } = setup({ pending: true });
    await expect(
      service.create('u1', 'Outro motivo valido'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('limite de pedidos em 30 dias', async () => {
    const { service } = setup({ recent: 3 });
    await expect(
      service.create('u1', 'Mais um motivo valido'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('aprovar roda o codigo do dono do pedido', async () => {
    const { service, social } = setup({ pending: true });
    const res = await service.decide('admin', 'r1', true);
    expect(res.status).toBe('APPROVED');
    expect(social.rotateFriendCode).toHaveBeenCalledWith('u1');
  });

  it('recusar nao roda o codigo', async () => {
    const { service, social } = setup({ pending: true });
    const res = await service.decide('admin', 'r1', false, 'Sem motivo claro');
    expect(res.status).toBe('REJECTED');
    expect(social.rotateFriendCode).not.toHaveBeenCalled();
  });

  it('dois admins ao mesmo tempo: so um decide', async () => {
    const { service, social } = setup({ pending: true, claim: 0 });
    await expect(service.decide('admin', 'r1', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(social.rotateFriendCode).not.toHaveBeenCalled();
  });

  it('pedido inexistente ou ja decidido: 404', async () => {
    const { service } = setup({ pending: false });
    await expect(service.decide('admin', 'r1', true)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
