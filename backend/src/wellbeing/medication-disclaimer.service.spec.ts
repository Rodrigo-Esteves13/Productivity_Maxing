import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MedicationDisclaimerService } from './medication-disclaimer.service';
import type { PrismaService } from '../prisma/prisma.service';
import { MEDICATION_DISCLAIMER_VERSION } from './wellbeing.constants';

describe('MedicationDisclaimerService', () => {
  const setup = (acceptedVersion: number | null) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          medicationDisclaimerVersion: acceptedVersion,
          medicationDisclaimerAcceptedAt: acceptedVersion ? new Date() : null,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new MedicationDisclaimerService(
      prisma as unknown as PrismaService,
    );
    return { service, prisma };
  };

  it('blocks until the current version is accepted', async () => {
    await expect(
      setup(null).service.assertAccepted('u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      setup(MEDICATION_DISCLAIMER_VERSION - 1).service.assertAccepted('u1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      setup(MEDICATION_DISCLAIMER_VERSION).service.assertAccepted('u1'),
    ).resolves.toBeUndefined();
  });

  it('only accepts the current version, for the signed-in user', async () => {
    const { service, prisma } = setup(null);
    await expect(
      service.accept('u1', MEDICATION_DISCLAIMER_VERSION + 1, 'pt'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
    await service.accept('u1', MEDICATION_DISCLAIMER_VERSION, 'pt');
    const [[args]] = prisma.user.update.mock.calls as [
      [{ where: { id: string }; data: { medicationDisclaimerLocale: string } }],
    ];
    expect(args.where.id).toBe('u1');
    expect(args.data.medicationDisclaimerLocale).toBe('pt');
  });
});
