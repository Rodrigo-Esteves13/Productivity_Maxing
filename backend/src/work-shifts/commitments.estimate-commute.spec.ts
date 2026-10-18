import { BadRequestException } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { DistanceMatrixService } from '../maps/distance-matrix.service';

function setup(opts: { homeAddress: string | null; minutes?: number }) {
  const prisma = {
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ homeAddress: opts.homeAddress }),
    },
  };
  const maps = {
    getTravelMinutes: jest.fn().mockResolvedValue(opts.minutes ?? 25),
  };
  const service = new CommitmentsService(
    prisma as unknown as PrismaService,
    maps as unknown as DistanceMatrixService,
  );
  return { service, maps };
}

describe('CommitmentsService.estimateCommute', () => {
  const dto = { address: 'Rua X 1, Porto', mode: 'TRANSIT' as const };

  it('exige a morada de casa no perfil e nao chama a Google Maps sem ela', async () => {
    const { service, maps } = setup({ homeAddress: null });
    await expect(service.estimateCommute('u1', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(maps.getTravelMinutes).not.toHaveBeenCalled();
  });

  it('usa SEMPRE a homeAddress do perfil como origem', async () => {
    const { service, maps } = setup({ homeAddress: 'Casa', minutes: 25 });
    await expect(service.estimateCommute('u1', dto)).resolves.toEqual({
      commuteMinutes: 25,
    });
    expect(maps.getTravelMinutes).toHaveBeenCalledWith(
      'Casa',
      'Rua X 1, Porto',
      'TRANSIT',
    );
  });

  it('limita o resultado ao maximo aceite pelo resto do sistema', async () => {
    const { service } = setup({ homeAddress: 'Casa', minutes: 999 });
    await expect(service.estimateCommute('u1', dto)).resolves.toEqual({
      commuteMinutes: 240,
    });
  });
});
