import { BadRequestException } from '@nestjs/common';
import {
  PasswordAuthService,
  RESET_LINK_INVALID_CODE,
} from './password-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { EmailVerificationService } from './email-verification.service';
import type { PasswordLinkService } from './password-link.service';

// E-02: o reset de password passa pelo backend, que valida o token de
// recovery no Supabase e devolve o User local para terminar as sessoes.
function setup(opts: { tokenValid: boolean; localUser: boolean }) {
  const getUser = jest
    .fn()
    .mockResolvedValue(
      opts.tokenValid
        ? { data: { user: { id: 'sb-1' } }, error: null }
        : { data: { user: null }, error: { message: 'invalid JWT' } },
    );
  const updateUserById = jest.fn().mockResolvedValue({ error: null });
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(opts.localUser ? { id: 'user-1' } : null),
    },
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    {
      admin: { auth: { getUser, admin: { updateUserById } } },
    } as unknown as SupabaseClientsService,
    {} as MailService,
    {} as AccountGuardService,
    {} as EmailVerificationService,
    {} as PasswordLinkService,
  );
  return { service, getUser, updateUserById, prisma };
}

describe('PasswordAuthService.completePasswordReset', () => {
  it('validates the recovery token, updates the password and returns the local user', async () => {
    const { service, getUser, updateUserById, prisma } = setup({
      tokenValid: true,
      localUser: true,
    });
    await expect(
      service.completePasswordReset('recovery-token', 'new-password-1'),
    ).resolves.toBe('user-1');
    expect(getUser).toHaveBeenCalledWith('recovery-token');
    expect(updateUserById).toHaveBeenCalledWith('sb-1', {
      password: 'new-password-1',
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supabaseAuthId: 'sb-1' } }),
    );
  });

  it('rejects an invalid token with a stable code and never touches the password', async () => {
    const { service, updateUserById } = setup({
      tokenValid: false,
      localUser: true,
    });
    const err: unknown = await service
      .completePasswordReset('bad', 'new-password-1')
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: RESET_LINK_INVALID_CODE,
    });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('returns null when the credential has no local user', async () => {
    const { service } = setup({ tokenValid: true, localUser: false });
    await expect(
      service.completePasswordReset('recovery-token', 'new-password-1'),
    ).resolves.toBeNull();
  });
});
