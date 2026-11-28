import { UnauthorizedException } from '@nestjs/common';
import { ProfileService } from './profile.service';
import type { PrismaService } from '../../prisma/prisma.service';

const ROW = {
  id: 'u1',
  email: 'u1@x.test',
  name: 'U One',
  avatarUrl: null,
  role: 'USER',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  activeProgramId: null,
  activePeriodId: null,
  commuteMinutes: null,
  commuteMode: null,
  homeAddress: null,
  campusAddress: null,
  quietHoursStart: null,
  quietHoursEnd: null,
  emailVerifiedAt: new Date('2026-01-02T00:00:00Z'),
  deadlineEmailReminders: true,
  deadlinePushReminders: true,
  mutedPushKinds: [],
  spacedReviewsEnabled: true,
  notesPrivateByDefault: false,
  twoFactorEnabledAt: null,
  supabaseAuthId: 'supabase-1',
};

// Campos que nunca podem sair do backend no perfil.
const SECRET_FIELDS = [
  'supabaseAuthId',
  'tokenVersion',
  'twoFactorSecret',
  'twoFactorRecoveryCodes',
  'calendarFeedToken',
  'emailVerifiedAt',
  'twoFactorEnabledAt',
];

function setup(row: unknown = ROW) {
  const prisma = { user: { findUnique: jest.fn().mockResolvedValue(row) } };
  const service = new ProfileService(prisma as unknown as PrismaService);
  return { service, prisma };
}

describe('ProfileService.build', () => {
  const previousFlag = process.env.TWO_FACTOR_ENABLED;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.TWO_FACTOR_ENABLED;
    else process.env.TWO_FACTOR_ENABLED = previousFlag;
  });

  it('reads only the caller row with an explicit select', async () => {
    const { service, prisma } = setup();
    await service.build('u1');
    const args = (prisma.user.findUnique.mock.calls[0] as unknown[])[0] as {
      where: { id: string };
      select: Record<string, boolean>;
    };
    expect(args.where).toEqual({ id: 'u1' });
    expect(args.select.tokenVersion).toBeUndefined();
    expect(args.select.id).toBe(true);
  });

  it('returns derived flags and never the raw secret fields', async () => {
    process.env.TWO_FACTOR_ENABLED = 'true';
    const { service } = setup();
    const profile = await service.build('u1');
    expect(profile).toEqual(
      expect.objectContaining({
        id: 'u1',
        hasPassword: true,
        emailVerified: true,
        twoFactorAvailable: true,
        twoFactorEnabled: false,
      }),
    );
    for (const field of SECRET_FIELDS) {
      expect(profile).not.toHaveProperty(field);
    }
  });

  it('flags an OAuth only, unverified account', async () => {
    const { service } = setup({
      ...ROW,
      supabaseAuthId: null,
      emailVerifiedAt: null,
      twoFactorEnabledAt: new Date(),
    });
    const profile = await service.build('u1');
    expect(profile.hasPassword).toBe(false);
    expect(profile.emailVerified).toBe(false);
    expect(profile.twoFactorEnabled).toBe(true);
  });

  it('throws 401 when the user no longer exists', async () => {
    const { service } = setup(null);
    await expect(service.build('gone')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
