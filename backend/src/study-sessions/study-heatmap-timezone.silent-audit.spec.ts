// Silent-bug audit (area a). FAILS while the bug exists. Prisma is mocked.
// Render runs the process in UTC. Run this file with the same zone:
//   TZ=UTC npx jest src/study-sessions/study-heatmap-timezone.silent-audit.spec.ts
// (inside jest the assignment below is not always honoured, e.g. on a
// Windows machine set to Lisbon the test then passes by accident).
process.env.TZ = 'UTC';

import { Prisma } from '@prisma/client';
import { StudySessionsService } from './study-sessions.service';
import type { PrismaService } from '../prisma/prisma.service';
import { APP_TIME_ZONE } from '../common/time.constants';

describe('[silent-audit a-08] "best times" heatmap uses the server clock, not Lisbon', () => {
  // B-33: weekday/hour now come from Postgres. The fix lives in the SQL: the
  // UTC column is converted to APP_TIME_ZONE (DST aware) before EXTRACT,
  // never read in the process zone.
  it('a session at 20:30 Lisbon (summer) lands in the 20-24 bucket', async () => {
    // Saturday 2026-07-04 20:30 Lisbon (UTC+1) = 19:30 UTC: Postgres, with
    // the Lisbon conversion, answers weekday 6 and hour 20.
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { dayOfWeek: 6, hour: 20, totalSeconds: 3600, sessionCount: 1 },
        ]),
    };
    const service = new StudySessionsService(
      prisma as unknown as PrismaService,
    );

    const grid = await service.getHeatmap('u1');
    const filled = grid.filter((c) => c.sessionCount > 0);

    const [query] = prisma.$queryRaw.mock.calls[0] as [Prisma.Sql];
    // BUG was: getDay()/getHours() read the process time zone (UTC).
    expect(query.text).toMatch(
      /EXTRACT\(DOW FROM l\."localStart"\)[\s\S]*\(\(s\."startedAt" AT TIME ZONE \$\d+::text\) AT TIME ZONE \$\d+::text\) AS "localStart"/,
    );
    expect(query.values).toEqual(['UTC', APP_TIME_ZONE, 'u1']);
    expect(filled).toEqual([
      expect.objectContaining({ dayOfWeek: 6, hourBucket: 5 }),
    ]);
  });
});
