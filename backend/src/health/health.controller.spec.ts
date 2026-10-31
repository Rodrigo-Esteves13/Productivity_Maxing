import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import type { PrismaService } from '../prisma/prisma.service';

function build(queryRaw: jest.Mock) {
  const service = new HealthService({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);
  return new HealthController(service);
}

describe('HealthController probes', () => {
  it('live returns 200 payload without touching the DB', () => {
    const queryRaw = jest.fn();
    const result = build(queryRaw).live();
    expect(result.status).toBe('ok');
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('live still works when the DB is down', () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('down'));
    expect(build(queryRaw).live().status).toBe('ok');
  });

  it('ready returns ok when the DB answers', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const result = await build(queryRaw).ready();
    expect(result).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('ready throws 503 when the DB fails', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('down'));
    const controller = build(queryRaw);
    const err = await controller.ready().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ServiceUnavailableException);
    expect((err as ServiceUnavailableException).getStatus()).toBe(503);
    expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
      database: 'unreachable',
    });
  });
});
