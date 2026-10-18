import { resolveShareAccess } from './share-role.util';
import type { PrismaService } from '../prisma/prisma.service';

type P = Pick<PrismaService, 'notebookShareAccessRequest' | 'friendship'>;

const share = (visibility: 'PUBLIC' | 'AUTHORIZED') => ({
  id: 's1',
  visibility,
  createdByUserId: 'owner',
});

function prismaWith(request: unknown, friends: boolean): P {
  return {
    notebookShareAccessRequest: {
      findUnique: jest.fn().mockResolvedValue(request),
    },
    friendship: {
      findFirst: jest.fn().mockResolvedValue(friends ? { id: 'f' } : null),
    },
  } as unknown as P;
}

describe('resolveShareAccess', () => {
  it('dono e OWNER; link publico e VIEWER', async () => {
    const p = prismaWith(null, false);
    expect(await resolveShareAccess(p, share('AUTHORIZED'), 'owner')).toEqual({
      state: 'ok',
      role: 'OWNER',
    });
    expect(await resolveShareAccess(p, share('PUBLIC'), null)).toEqual({
      state: 'ok',
      role: 'VIEWER',
    });
  });

  it('AUTHORIZED sem sessao ou sem pedido nao entra', async () => {
    const p = prismaWith(null, true);
    expect(await resolveShareAccess(p, share('AUTHORIZED'), null)).toEqual({
      state: 'login_required',
    });
    expect(await resolveShareAccess(p, share('AUTHORIZED'), 'u')).toEqual({
      state: 'not_requested',
    });
  });

  it('convite pendente distingue-se de pedido pendente', async () => {
    const invite = { id: 'r1', status: 'PENDING', invitedByOwner: true };
    const ask = { id: 'r2', status: 'PENDING', invitedByOwner: false };
    expect(
      await resolveShareAccess(
        prismaWith(invite, true),
        share('AUTHORIZED'),
        'u',
      ),
    ).toEqual({ state: 'invited', requestId: 'r1' });
    expect(
      await resolveShareAccess(prismaWith(ask, true), share('AUTHORIZED'), 'u'),
    ).toEqual({ state: 'pending' });
  });

  it('convite aprovado so vale enquanto forem amigos', async () => {
    const approved = {
      id: 'r1',
      status: 'APPROVED',
      invitedByOwner: true,
      accessRole: 'CO_OWNER',
    };
    expect(
      await resolveShareAccess(
        prismaWith(approved, true),
        share('AUTHORIZED'),
        'u',
      ),
    ).toEqual({ state: 'ok', role: 'CO_OWNER' });
    expect(
      await resolveShareAccess(
        prismaWith(approved, false),
        share('AUTHORIZED'),
        'u',
      ),
    ).toEqual({ state: 'denied' });
  });

  it('pedido aprovado pelo link nao depende de amizade', async () => {
    const approved = {
      id: 'r1',
      status: 'APPROVED',
      invitedByOwner: false,
      accessRole: 'EDITOR',
    };
    expect(
      await resolveShareAccess(
        prismaWith(approved, false),
        share('AUTHORIZED'),
        'u',
      ),
    ).toEqual({ state: 'ok', role: 'EDITOR' });
  });
});
