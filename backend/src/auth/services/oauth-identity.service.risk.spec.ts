import { ConflictException } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { OAuthIdentityService } from './oauth-identity.service';
import { OAuthAccountConflictException } from '../exceptions/oauth-account-conflict.exception';
import type { OAuthProfileData } from './oauth-profile.interface';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { SessionStateService } from '../../account-status/session-state.service';
import type { AccountGuardService } from './account-guard.service';
const contains = (o: object): unknown => expect.objectContaining(o);
const anyOf = (c: unknown): unknown => expect.any(c as typeof String);

const EXISTING_USER = {
  id: 'victim',
  email: 'victim@example.test',
  supabaseAuthId: 'sb-victim',
  emailVerifiedAt: null,
  avatarUrl: null,
};

function profile(over: Partial<OAuthProfileData> = {}): OAuthProfileData {
  return {
    provider: Provider.GOOGLE,
    providerAccountId: 'g-1',
    email: ' Victim@Example.Test ',
    emailVerified: true,
    ...over,
  };
}

function setup(opts: { identityCount?: number; emailUser?: unknown } = {}) {
  const prisma = {
    identity: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(opts.identityCount ?? 0),
    },
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          opts.emailUser === undefined ? EXISTING_USER : opts.emailUser,
        ),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...EXISTING_USER, ...data }),
        ),
      findUniqueOrThrow: jest.fn().mockResolvedValue(EXISTING_USER),
    },
  };
  const updateUserById = jest.fn().mockResolvedValue({ error: null });
  const clients = { admin: { auth: { admin: { updateUserById } } } };
  const sessionState = {
    bumpTokenVersion: jest.fn().mockResolvedValue({ ...EXISTING_USER }),
  };
  const accountGuard = { assertAccountIsUsable: jest.fn() };
  const service = new OAuthIdentityService(
    prisma as unknown as PrismaService,
    clients as unknown as SupabaseClientsService,
    sessionState as unknown as SessionStateService,
    accountGuard as unknown as AccountGuardService,
  );
  return { service, prisma, updateUserById, sessionState, accountGuard };
}

describe('OAuthIdentityService.resolveIdentity merge rules', () => {
  it('never merges by email when the provider did not verify it', async () => {
    const { service, prisma, updateUserById } = setup();
    // So a procura de colisao corre (1 chamada); o dono do email nao e fundido.
    await expect(
      service.resolveIdentity(profile({ emailVerified: false })),
    ).rejects.toBeInstanceOf(OAuthAccountConflictException);
    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.identity.create).not.toHaveBeenCalled();
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('creates a new user when unverified and the email is free', async () => {
    const { service, prisma } = setup({ emailUser: null });
    await service.resolveIdentity(profile({ emailVerified: false }));
    expect(prisma.user.create).toHaveBeenCalledTimes(1);
    expect(prisma.identity.create).toHaveBeenCalledWith({
      data: contains({ providerAccountId: 'g-1' }),
    });
  });

  it('maps a P2002 race on create to the conflict exception', async () => {
    const { service, prisma } = setup({ emailUser: null });
    prisma.user.create.mockRejectedValue({ code: 'P2002' });
    await expect(
      service.resolveIdentity(profile({ emailVerified: false })),
    ).rejects.toBeInstanceOf(OAuthAccountConflictException);
  });

  it('rethrows non unique errors on create', async () => {
    const { service, prisma } = setup({ emailUser: null });
    prisma.user.create.mockRejectedValue(new Error('db down'));
    await expect(
      service.resolveIdentity(profile({ emailVerified: false })),
    ).rejects.toThrow('db down');
  });

  it('merges a verified email, neutralizes the password and verifies the account', async () => {
    const { service, prisma, updateUserById, sessionState } = setup();
    const result = await service.resolveIdentity(profile());
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      contains({
        where: {
          email: { equals: 'victim@example.test', mode: 'insensitive' },
        },
      }),
    );
    expect(updateUserById).toHaveBeenCalledWith(
      'sb-victim',
      contains({ password: anyOf(String) }),
    );
    expect(sessionState.bumpTokenVersion).toHaveBeenCalledWith('victim');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'victim' },
      data: { emailVerifiedAt: anyOf(Date) },
    });
    expect(prisma.identity.create).toHaveBeenCalledWith({
      data: contains({ userId: 'victim', provider: 'GOOGLE' }),
    });
    expect(result.id).toBe('victim');
  });

  it('does not neutralize the password when the account already had an identity', async () => {
    const { service, updateUserById, sessionState } = setup({
      identityCount: 1,
    });
    await service.resolveIdentity(profile());
    expect(updateUserById).not.toHaveBeenCalled();
    expect(sessionState.bumpTokenVersion).not.toHaveBeenCalled();
  });

  it('fails closed: supabase error aborts the login, no identity linked', async () => {
    const { service, prisma, updateUserById } = setup();
    updateUserById.mockResolvedValue({
      error: { message: 'down', status: 500 },
    });
    await expect(service.resolveIdentity(profile())).rejects.toThrow(
      'Could not secure the account',
    );
    expect(prisma.identity.create).not.toHaveBeenCalled();
  });

  it('checks the account state before merging', async () => {
    const { service, accountGuard, prisma } = setup();
    accountGuard.assertAccountIsUsable.mockImplementation(() => {
      throw new Error('banned');
    });
    await expect(service.resolveIdentity(profile())).rejects.toThrow('banned');
    expect(prisma.identity.create).not.toHaveBeenCalled();
  });
});

describe('OAuthIdentityService.linkIdentity', () => {
  it('refuses a provider account linked to another user', async () => {
    const { service, prisma } = setup();
    prisma.identity.findUnique.mockResolvedValue({
      id: 'i1',
      userId: 'someone-else',
    });
    await expect(service.linkIdentity('me', profile())).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(prisma.identity.create).not.toHaveBeenCalled();
    expect(prisma.identity.update).not.toHaveBeenCalled();
  });

  it('creates the identity for the authenticated user', async () => {
    const { service, prisma } = setup();
    await service.linkIdentity('me', profile());
    expect(prisma.identity.create).toHaveBeenCalledWith({
      data: contains({ userId: 'me' }),
    });
  });

  it('keeps stored tokens when the provider sends no new ones', async () => {
    const { service, prisma } = setup();
    prisma.identity.findUnique.mockResolvedValue({
      id: 'i1',
      userId: 'me',
      accessToken: 'enc-a',
      refreshToken: 'enc-r',
      scope: 'old',
    });
    await service.linkIdentity('me', profile());
    expect(prisma.identity.update).toHaveBeenCalledWith({
      where: { id: 'i1' },
      data: { accessToken: 'enc-a', refreshToken: 'enc-r', scope: 'old' },
    });
  });
});
