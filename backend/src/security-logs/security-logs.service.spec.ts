import { SecurityEventType } from '@prisma/client';
import { SecurityLogsService } from './security-logs.service';
import type { PrismaService } from '../prisma/prisma.service';

// E-07/E-08: as stats somam o `count` agregado de cada linha e ignoram as
// linhas de moderacao de pads.
describe('SecurityLogsService.getStats', () => {
  it('sums blocked requests of rate-limit rows only', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { count: 50 } })
      .mockResolvedValueOnce({ _sum: { count: null } });
    const groupBy = jest
      .fn()
      .mockResolvedValue([{ ip: '203.0.113.7', _sum: { count: 50 } }]);
    const service = new SecurityLogsService({
      securityLog: { aggregate, groupBy },
    } as unknown as PrismaService);

    const stats = await service.getStats();

    expect(stats).toEqual({
      totalLastHour: 50,
      totalLast24h: 0,
      topOffenders: [{ ip: '203.0.113.7', count: 50 }],
    });
    const calls = [
      ...(aggregate.mock.calls as unknown[][]),
      ...(groupBy.mock.calls as unknown[][]),
    ] as [{ where: { type: SecurityEventType } }][];
    for (const [args] of calls) {
      expect(args.where.type).toBe(SecurityEventType.RATE_LIMIT_EXCEEDED);
    }
  });
});
