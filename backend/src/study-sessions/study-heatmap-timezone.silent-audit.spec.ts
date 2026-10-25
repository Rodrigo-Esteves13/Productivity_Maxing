// Silent-bug audit (area a). FAILS while the bug exists. Prisma is mocked.
// Render runs the process in UTC. Run this file with the same zone:
//   TZ=UTC npx jest src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts
// (inside jest the assignment below is not always honoured, e.g. on a
// Windows machine set to Lisbon the test then passes by accident).
process.env.TZ = 'UTC';

import { StudySessionsService } from './study-sessions.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('[silent-audit a-08] "best times" heatmap uses the server clock, not Lisbon', () => {
  it('a session at 20:30 Lisbon (summer) lands in the 20-24 bucket', async () => {
    // Saturday 2026-07-04 20:30 Lisbon (UTC+1) = 19:30 UTC.
    const startedAt = new Date('2026-07-04T19:30:00.000Z');
    const prisma = {
      studySession: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { startedAt, endedAt: new Date(startedAt.getTime() + 60 * 60_000) },
          ]),
      },
    };
    const service = new StudySessionsService(
      prisma as unknown as PrismaService,
    );

    const grid = await service.getHeatmap('u1');
    const filled = grid.filter((c) => c.sessionCount > 0);

    // BUG: getDay()/getHours() read the process time zone (UTC), so the
    // session is shown at 16-20 instead of 20-24. Every other stat in the
    // same service (streak, daily totals) already uses Lisbon days.
    expect(filled).toEqual([
      expect.objectContaining({ dayOfWeek: 6, hourBucket: 5 }),
    ]);
  });
});
