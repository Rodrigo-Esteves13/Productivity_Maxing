import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PasswordAuthService } from './password-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { EmailVerificationService } from './email-verification.service';
import type { PasswordLinkService } from './password-link.service';

function setup(
  user: { supabaseAuthId: string | null },
  signInError: unknown = null,
) {
  const prisma = {
    user: {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id: 'u1', email: 'a@example.test', ...user }),
      update: jest.fn(),
    },
  };
  const clients = {
    anon: {
      auth: {
        signInWithPassword: jest.fn().mockResolvedValue({ error: signInError }),
      },
    },
    admin: {
      auth: {
        admin: {
          updateUserById: jest.fn().mockResolvedValue({ error: null }),
          createUser: jest
            .fn()
            .mockResolvedValue({ data: { user: { id: 'sb1' } }, error: null }),
        },
      },
    },
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    clients as unknown as SupabaseClientsService,
    {} as MailService,
    {} as AccountGuardService,
    {} as EmailVerificationService,
    {} as PasswordLinkService,
  );
  return { service, clients };
}

describe('PasswordAuthService.setPassword', () => {
  it('requires the current password when the account already has one', async () => {
    const { service, clients } = setup({ supabaseAuthId: 'sb1' });
    await expect(
      service.setPassword('u1', 'new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(clients.admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('rejects a wrong current password without changing anything', async () => {
    const { service, clients } = setup(
      { supabaseAuthId: 'sb1' },
      { message: 'Invalid login credentials' },
    );
    await expect(
      service.setPassword('u1', 'new-password', 'wrong-password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(clients.admin.auth.admin.updateUserById).not.toHaveBeenCalled();
  });

  it('changes the password when the current one is right', async () => {
    const { service, clients } = setup({ supabaseAuthId: 'sb1' });
    await service.setPassword('u1', 'new-password', 'old-password');
    expect(clients.anon.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@example.test',
      password: 'old-password',
    });
    expect(clients.admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      'sb1',
      {
        password: 'new-password',
      },
    );
  });

  it('lets an OAuth-only account add a first password without a current one', async () => {
    const { service, clients } = setup({ supabaseAuthId: null });
    await service.setPassword('u1', 'new-password');
    expect(clients.anon.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(clients.admin.auth.admin.createUser).toHaveBeenCalled();
  });
});
