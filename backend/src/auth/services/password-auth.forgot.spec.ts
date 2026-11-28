import { PasswordAuthService } from './password-auth.service';
import {
  type EmailVerificationService,
  RESEND_COOLDOWN_MS,
} from './email-verification.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { SupabaseClientsService } from './supabase-clients.service';
import type { MailService } from '../../mail/mail.service';
import type { AccountGuardService } from './account-guard.service';
import type { PasswordLinkService } from './password-link.service';

// S-11: forgot-password com cooldown por email normalizado e o trabalho todo
// em background (mesma resposta, no mesmo tempo, em todos os caminhos).
const ACTION_LINK = 'https://example.test/recovery';

function flushBackground(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function setup(local: { id: string; supabaseAuthId: string | null } | null) {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue(local) },
  };
  const generateLink = jest.fn().mockResolvedValue({
    data: { properties: { action_link: ACTION_LINK } },
    error: null,
  });
  const mail = { sendPasswordResetEmail: jest.fn().mockResolvedValue(true) };
  const passwordLink = {
    canLink: (u: { supabaseAuthId: string | null }) =>
      u.supabaseAuthId === null,
    send: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordAuthService(
    prisma as unknown as PrismaService,
    {
      admin: { auth: { admin: { generateLink } } },
    } as unknown as SupabaseClientsService,
    mail as unknown as MailService,
    {} as AccountGuardService,
    {} as EmailVerificationService,
    passwordLink as unknown as PasswordLinkService,
  );
  return { service, prisma, generateLink, mail, passwordLink };
}

describe('PasswordAuthService.forgotPassword', () => {
  afterEach(() => jest.restoreAllMocks());

  it('answers without waiting for the lookup or Supabase (same timing on every path)', async () => {
    const { service, prisma, generateLink } = setup({
      id: 'u1',
      supabaseAuthId: 'sb-1',
    });
    // A procura na BD nunca acaba: a resposta sai na mesma.
    prisma.user.findFirst.mockReturnValue(new Promise(() => undefined));
    await expect(
      service.forgotPassword('owner@example.test'),
    ).resolves.toBeUndefined();
    await flushBackground();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('runs generateLink in the background', async () => {
    const { service, generateLink } = setup({
      id: 'u1',
      supabaseAuthId: 'sb-1',
    });
    await service.forgotPassword('owner@example.test');
    await flushBackground();
    expect(generateLink).toHaveBeenCalledTimes(1);
  });

  it('sends the reset email through generateLink for an account with a password', async () => {
    const { service, mail, passwordLink } = setup({
      id: 'u1',
      supabaseAuthId: 'sb-1',
    });
    await service.forgotPassword('owner@example.test');
    await flushBackground();
    expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
      'owner@example.test',
      ACTION_LINK,
    );
    expect(passwordLink.send).not.toHaveBeenCalled();
  });

  it('sends the password link for an OAuth-only account, without generateLink', async () => {
    const { service, generateLink, passwordLink } = setup({
      id: 'u2',
      supabaseAuthId: null,
    });
    await service.forgotPassword('oauth@example.test');
    await flushBackground();
    expect(passwordLink.send).toHaveBeenCalledTimes(1);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it('applies the cooldown per normalized email, across case and spaces', async () => {
    const { service, generateLink } = setup({
      id: 'u1',
      supabaseAuthId: 'sb-1',
    });
    await service.forgotPassword('Owner@Example.test');
    await service.forgotPassword('  owner@example.TEST ');
    await flushBackground();
    expect(generateLink).toHaveBeenCalledTimes(1);
  });

  it('allows a new request once the cooldown has passed', async () => {
    const { service, generateLink } = setup({
      id: 'u1',
      supabaseAuthId: 'sb-1',
    });
    const start = 1_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(start);
    await service.forgotPassword('owner@example.test');
    now.mockReturnValue(start + RESEND_COOLDOWN_MS);
    await service.forgotPassword('owner@example.test');
    await flushBackground();
    expect(generateLink).toHaveBeenCalledTimes(2);
  });

  it('keeps different emails independent', async () => {
    const { service, generateLink } = setup(null);
    await service.forgotPassword('a@example.test');
    await service.forgotPassword('b@example.test');
    await flushBackground();
    expect(generateLink).toHaveBeenCalledTimes(2);
  });

  it('never rejects when the background work fails', async () => {
    const { service, prisma } = setup(null);
    prisma.user.findFirst.mockRejectedValue(new Error('db down'));
    await expect(
      service.forgotPassword('a@example.test'),
    ).resolves.toBeUndefined();
    await flushBackground();
  });
});
