import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PasswordAuthService } from './services/password-auth.service';
import type { SessionTokenService } from './services/session-token.service';

// file-type e ESM puro (usado pelo AvatarService), o Jest nao o transforma.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));

function build(overrides: {
  prisma?: unknown;
  password?: unknown;
  tokens?: unknown;
}) {
  const none = {} as never;
  return new AuthService(
    (overrides.prisma ?? none) as PrismaService,
    none,
    none,
    none,
    (overrides.password ?? none) as PasswordAuthService,
    none,
    (overrides.tokens ?? none) as SessionTokenService,
    none,
    none,
    none,
  );
}

describe('AuthService.updateProfile (E-05)', () => {
  it('writes null for cleared optional fields and ignores null on required ones', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = build({ prisma: { user: { update } } });
    await service.updateProfile('user-1', {
      commuteMinutes: null,
      homeAddress: null,
      campusAddress: null,
      quietHoursStart: null,
      quietHoursEnd: null,
      deadlineEmailReminders: null as unknown as boolean,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        commuteMinutes: null,
        homeAddress: null,
        campusAddress: null,
        quietHoursStart: null,
        quietHoursEnd: null,
      },
    });
  });

  it('leaves fields that were not sent untouched', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = build({ prisma: { user: { update } } });
    await service.updateProfile('user-1', { quietHoursStart: 1380 });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { quietHoursStart: 1380 },
    });
  });
});

describe('AuthService.completePasswordReset (E-02)', () => {
  it('revokes every session of the account after the reset', async () => {
    const revokeAllSessions = jest.fn().mockResolvedValue({});
    const service = build({
      password: {
        completePasswordReset: jest.fn().mockResolvedValue('user-1'),
      },
      tokens: { revokeAllSessions },
    });
    await service.completePasswordReset('token', 'new-password-1');
    expect(revokeAllSessions).toHaveBeenCalledWith('user-1');
  });

  it('does nothing more when the credential has no local user', async () => {
    const revokeAllSessions = jest.fn();
    const service = build({
      password: { completePasswordReset: jest.fn().mockResolvedValue(null) },
      tokens: { revokeAllSessions },
    });
    await service.completePasswordReset('token', 'new-password-1');
    expect(revokeAllSessions).not.toHaveBeenCalled();
  });
});
