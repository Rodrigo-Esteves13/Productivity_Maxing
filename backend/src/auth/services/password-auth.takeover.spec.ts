import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PasswordAuthService } from './password-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { EmailVerificationService } from './email-verification.service';
import type { PasswordLinkService } from './password-link.service';

// SCR-002: uma conta que ja existe (ex: so-OAuth) nunca pode ser aberta por
// quem cria uma password com o mesmo email. So o dono do email (link
// enviado para a caixa dele) lhe junta uma password.
const OAUTH_USER = {
  id: 'victim',
  email: 'victim@example.test',
  supabaseAuthId: null as string | null,
  emailVerifiedAt: new Date() as Date | null,
};

function setup(
  existing: typeof OAUTH_USER | null,
  identityCount: number,
  supabaseUserId = 'sb-attacker',
) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(existing),
      findUnique: jest.fn().mockResolvedValue(existing),
      findUniqueOrThrow: jest.fn().mockResolvedValue(existing),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...existing,
          ...data,
        })),
      create: jest.fn(),
    },
    identity: { count: jest.fn().mockResolvedValue(identityCount) },
  };
  const user = { id: supabaseUserId, user_metadata: {} };
  const clients = {
    anon: {
      auth: {
        signUp: jest.fn().mockResolvedValue({ data: { user }, error: null }),
        signInWithPassword: jest
          .fn()
          .mockResolvedValue({ data: { user }, error: null }),
      },
    },
    admin: {
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'sb-owner' } },
            error: null,
          }),
          generateLink: jest.fn(),
        },
      },
    },
  };
  const emailVerification = {
    isRequired: () => false,
    needsVerification: () => false,
  };
  const passwordLink = {
    canLink: (u: { supabaseAuthId: string | null }) =>
      u.supabaseAuthId === null,
    send: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(existing),
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    clients as unknown as SupabaseClientsService,
    {} as MailService,
    { assertAccountIsUsable: jest.fn() } as unknown as AccountGuardService,
    emailVerification as unknown as EmailVerificationService,
    passwordLink as unknown as PasswordLinkService,
  );
  return { service, prisma, clients, passwordLink };
}

describe('PasswordAuthService account takeover guards', () => {
  it('registering the email of an account without a password only emails its owner', async () => {
    const { service, clients, passwordLink } = setup(OAUTH_USER, 1);
    await expect(
      service.registerWithPassword({
        email: OAUTH_USER.email,
        password: 'attacker-password',
      }),
    ).resolves.toEqual({
      kind: 'password-link-sent',
      email: OAUTH_USER.email,
    });
    expect(passwordLink.send).toHaveBeenCalledWith(OAUTH_USER);
    // Nenhuma credencial nova com a password de quem fez o pedido.
    expect(clients.anon.auth.signUp).not.toHaveBeenCalled();
  });

  it('answers without waiting for the email to be sent', async () => {
    const { service, passwordLink } = setup(OAUTH_USER, 1);
    // SMTP pendurado (ex: porta bloqueada): o registo responde na mesma.
    passwordLink.send.mockReturnValue(new Promise<void>(() => undefined));
    await expect(
      service.registerWithPassword({
        email: OAUTH_USER.email,
        password: 'any-password',
      }),
    ).resolves.toMatchObject({ kind: 'password-link-sent' });
  });

  it('refuses to register the email of an account that already has a password', async () => {
    const { service, clients, passwordLink } = setup(
      { ...OAUTH_USER, supabaseAuthId: 'sb-owner' },
      0,
    );
    await expect(
      service.registerWithPassword({
        email: OAUTH_USER.email,
        password: 'attacker-password',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(passwordLink.send).not.toHaveBeenCalled();
    expect(clients.anon.auth.signUp).not.toHaveBeenCalled();
  });

  it('refuses a password login into an OAuth-only account', async () => {
    const { service, prisma } = setup(OAUTH_USER, 1);
    await expect(
      service.loginWithPassword(OAUTH_USER.email, 'attacker-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a credential that is not the one linked to the account', async () => {
    const { service, prisma } = setup(
      { ...OAUTH_USER, supabaseAuthId: 'sb-owner' },
      0,
    );
    await expect(
      service.loginWithPassword(OAUTH_USER.email, 'attacker-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('still logs in the owner of the linked credential', async () => {
    const { service } = setup(
      { ...OAUTH_USER, supabaseAuthId: 'sb-owner' },
      0,
      'sb-owner',
    );
    await expect(
      service.loginWithPassword(OAUTH_USER.email, 'owner-password'),
    ).resolves.toMatchObject({ id: 'victim' });
  });
});

describe('PasswordAuthService password link', () => {
  it('links the password chosen on the email link to the same account', async () => {
    const { service, prisma, clients } = setup(OAUTH_USER, 1);
    await expect(
      service.completePasswordLink('token', 'owner-password'),
    ).resolves.toEqual({ email: OAUTH_USER.email });
    expect(clients.admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: OAUTH_USER.email,
        password: 'owner-password',
      }),
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OAUTH_USER.id },
      data: { supabaseAuthId: 'sb-owner' },
    });
  });

  it('marks the email as verified when the link is used', async () => {
    const { service, prisma } = setup(
      { ...OAUTH_USER, emailVerifiedAt: null },
      0,
    );
    await service.completePasswordLink('token', 'owner-password');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: OAUTH_USER.id },
      data: { emailVerifiedAt: expect.any(Date) as Date },
    });
  });

  it('creates nothing when the link is invalid', async () => {
    const { service, clients, passwordLink } = setup(OAUTH_USER, 1);
    passwordLink.consume.mockRejectedValue(new BadRequestException());
    await expect(
      service.completePasswordLink('bad', 'owner-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(clients.admin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it('forgot password on an account without a password sends the link', async () => {
    const { service, clients, passwordLink } = setup(OAUTH_USER, 1);
    await service.forgotPassword(OAUTH_USER.email);
    expect(passwordLink.send).toHaveBeenCalledWith(OAUTH_USER);
    expect(clients.admin.auth.admin.generateLink).not.toHaveBeenCalled();
  });
});
