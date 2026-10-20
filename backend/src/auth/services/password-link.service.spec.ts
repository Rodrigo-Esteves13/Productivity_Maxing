import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { PasswordLinkService } from './password-link.service';
import type { PrismaService } from '../../prisma/prisma.service';
import type { MailService } from '../../mail/mail.service';

const USER = {
  id: 'u1',
  email: 'owner@example.test',
  supabaseAuthId: null as string | null,
  status: UserStatus.ACTIVE as UserStatus,
};

function setup(stored: typeof USER | null = USER) {
  process.env.JWT_SECRET = 'test-secret';
  const jwtService = new JwtService({});
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(stored) },
  };
  const mail = {
    sendPasswordLinkEmail: jest.fn().mockResolvedValue(undefined),
  };
  const service = new PasswordLinkService(
    prisma as unknown as PrismaService,
    jwtService,
    mail as unknown as MailService,
  );
  return { service, mail, jwtService };
}

function sentArgs(mail: { sendPasswordLinkEmail: jest.Mock }) {
  return mail.sendPasswordLinkEmail.mock.calls[0] as [string, string];
}

function sentLink(mail: { sendPasswordLinkEmail: jest.Mock }): URL {
  return new URL(sentArgs(mail)[1]);
}

describe('PasswordLinkService', () => {
  it('emails a link whose token opens the same account', async () => {
    const { service, mail } = setup();
    await service.send(USER);
    expect(mail.sendPasswordLinkEmail).toHaveBeenCalledTimes(1);
    expect(sentArgs(mail)[0]).toBe(USER.email);
    const link = sentLink(mail);
    expect(link.pathname).toBe('/set-password');
    await expect(
      service.consume(link.searchParams.get('token') ?? ''),
    ).resolves.toEqual(USER);
  });

  it('does not email an account that already has a password, or a banned one', async () => {
    const { service, mail } = setup();
    await service.send({ ...USER, supabaseAuthId: 'sb1' });
    await service.send({ ...USER, id: 'u2', status: UserStatus.BANNED });
    expect(mail.sendPasswordLinkEmail).not.toHaveBeenCalled();
  });

  it('sends at most one email per minute to the same account', async () => {
    const { service, mail } = setup();
    await service.send(USER);
    await service.send(USER);
    expect(mail.sendPasswordLinkEmail).toHaveBeenCalledTimes(1);
  });

  it('rejects a link once the account has a password', async () => {
    const { service, mail } = setup({ ...USER, supabaseAuthId: 'sb1' });
    await service.send(USER);
    await expect(
      service.consume(sentLink(mail).searchParams.get('token') ?? ''),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects tokens signed for anything else', async () => {
    const { service, jwtService } = setup();
    const session = jwtService.sign(
      { sub: USER.id, email: USER.email },
      { secret: 'test-secret' },
    );
    await expect(service.consume(session)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.consume('garbage')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
