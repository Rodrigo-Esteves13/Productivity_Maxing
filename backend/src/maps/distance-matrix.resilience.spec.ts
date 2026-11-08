import {
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DistanceMatrixService } from './distance-matrix.service';
import { TravelTimesService, travelPairKey } from './travel-times.service';
import {
  MAPS_BREAKER_FAILURE_THRESHOLD,
  MAPS_BREAKER_OPEN_MS,
} from '../common/http-resilience.constants';
import type { PrismaService } from '../prisma/prisma.service';

const okBody = {
  status: 'OK',
  rows: [{ elements: [{ status: 'OK', duration: { value: 1200, text: '' } }] }],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200 });

describe('DistanceMatrixService resilience', () => {
  let fetchMock: jest.SpyInstance;
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_MAPS_API_KEY = 'test-key';
    fetchMock = jest.spyOn(global, 'fetch');
    jest.useFakeTimers({ now: new Date('2026-11-06T10:00:00Z') });
  });
  afterEach(() => {
    jest.useRealTimers();
    fetchMock.mockRestore();
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  async function tripOpen(service: DistanceMatrixService) {
    fetchMock.mockRejectedValue(new Error('network down'));
    for (let i = 0; i < MAPS_BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(
        service.getTravelMinutes('A', 'B', 'DRIVING'),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
    }
  }

  it('sends every request with a timeout signal', async () => {
    fetchMock.mockResolvedValueOnce(json(okBody));
    await expect(
      new DistanceMatrixService().getTravelMinutes('A', 'B', 'DRIVING'),
    ).resolves.toBe(20);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails fast with 503 once open, then probes again after the open time', async () => {
    const service = new DistanceMatrixService();
    await tripOpen(service);
    fetchMock.mockClear();

    await expect(
      service.getTravelMinutes('A', 'B', 'DRIVING'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();

    jest.advanceTimersByTime(MAPS_BREAKER_OPEN_MS);
    fetchMock.mockResolvedValueOnce(json(okBody));
    await expect(service.getTravelMinutes('A', 'B', 'DRIVING')).resolves.toBe(
      20,
    );
  });

  it('quota errors open the circuit, bad addresses do not', async () => {
    const service = new DistanceMatrixService();
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ status: 'ZERO_RESULTS' })),
    );
    for (let i = 0; i < MAPS_BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(
        service.getTravelMinutes('A', 'B', 'DRIVING'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ status: 'OVER_QUERY_LIMIT' })),
    );
    for (let i = 0; i < MAPS_BREAKER_FAILURE_THRESHOLD; i++) {
      await expect(
        service.getTravelMinutes('A', 'B', 'DRIVING'),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    await expect(
      service.getTravelMinutes('A', 'B', 'DRIVING'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('TravelTimesService keeps the stale value while the circuit is open', async () => {
    const distanceMatrix = new DistanceMatrixService();
    await tripOpen(distanceMatrix);
    fetchMock.mockClear();

    const pair = { origin: 'A', destination: 'B', mode: 'DRIVING' as const };
    const prisma = {
      travelTime: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { ...pair, minutes: 33, updatedAt: new Date('2020-01-01') },
          ]),
        upsert: jest.fn(),
      },
    };
    const travelTimes = new TravelTimesService(
      prisma as unknown as PrismaService,
      distanceMatrix,
    );
    const result = await travelTimes.resolve('u1', [pair]);
    expect(result.get(travelPairKey(pair))).toBe(33);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(prisma.travelTime.upsert).not.toHaveBeenCalled();
  });
});
