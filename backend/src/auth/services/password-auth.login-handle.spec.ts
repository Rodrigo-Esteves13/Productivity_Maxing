import { UnauthorizedException } from '@nestjs/common';
import { PasswordAuthService } from './password-auth.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { EmailVerificationService } from './email-verification.service';
import type { PasswordLinkService } from './password-link.service';

// Login com so a parte antes do @ (ex: numero de aluno).
function setup(emails: string[]) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue(emails.map((email) => ({ email }))),
    },
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    {} as SupabaseClientsService,
    {} as MailService,
    {} as AccountGuardService,
    {} as EmailVerificationService,
    {} as PasswordLinkService,
  );
  return { service, prisma };
}

describe('PasswordAuthService.resolveLoginEmail', () => {
  it('passes a full email through without a lookup', async () => {
    const { service, prisma } = setup([]);
    await expect(service.resolveLoginEmail('a@b.pt')).resolves.toBe('a@b.pt');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('finds the only account whose email starts with the handle', async () => {
    const { service, prisma } = setup(['a047610@uni.pt']);
    await expect(service.resolveLoginEmail('A047610')).resolves.toBe(
      'a047610@uni.pt',
    );
    const [args] = prisma.user.findMany.mock.calls[0] as [{ where: unknown }];
    expect(args.where).toEqual({
      email: { startsWith: 'A047610@', mode: 'insensitive' },
    });
  });

  it('refuses ambiguous, unknown or odd handles like a wrong password', async () => {
    for (const [handle, emails] of [
      ['a1', ['a1@x.pt', 'a1@y.pt']],
      ['a1', []],
      ['a%', ['a1@x.pt']],
    ] as const) {
      const { service } = setup([...emails]);
      await expect(service.resolveLoginEmail(handle)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    }
  });
});
