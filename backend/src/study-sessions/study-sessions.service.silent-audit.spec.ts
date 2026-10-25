// Regression tests from the silent-bug audit (area a). Each test describes
// the behaviour the user expects. Prisma is mocked: no database.
import { StudySessionsService } from './study-sessions.service';
import type { PrismaService } from '../prisma/prisma.service';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type Row = {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt: Date | null;
  lastHeartbeatAt: Date | null;
  note: string | null;
  focusRating: number | null;
};

function setup(row: Row) {
  const db = { row: { ...row } };
  const prisma = {
    studySession: {
      findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
        const r = db.row;
        if (where.userId && where.userId !== r.userId) return null;
        if (where.id && where.id !== r.id) return null;
        if ('endedAt' in where && where.endedAt === null && r.endedAt !== null)
          return null;
        return Promise.resolve({
          ...r,
          isManual: false,
          taskId: null,
          areaId: null,
          task: null,
          area: null,
        });
      }),
      update: jest.fn(({ data }: { data: Partial<Row> }) => {
        db.row = { ...db.row, ...data };
        return Promise.resolve({
          ...db.row,
          isManual: false,
          taskId: null,
          areaId: null,
          task: null,
          area: null,
        });
      }),
      updateMany: jest.fn(
        ({
          where,
          data,
        }: {
          where: { endedAt?: null };
          data: Partial<Row>;
        }) => {
          if (where.endedAt === null && db.row.endedAt !== null)
            return Promise.resolve({ count: 0 });
          db.row = { ...db.row, ...data };
          return Promise.resolve({ count: 1 });
        },
      ),
    },
  };
  const service = new StudySessionsService(prisma as unknown as PrismaService);
  return { service, db };
}

describe('[silent-audit a-01] stopping a session that ran more than 16 hours', () => {
  it('Stop must close the running session instead of failing with 400 forever', async () => {
    // Session started 17h ago, tab left open overnight: heartbeats kept it
    // alive (last beat 30s ago), so autoCloseIfStale never fires.
    const now = Date.now();
    const { service, db } = setup({
      id: 's1',
      userId: 'u1',
      startedAt: new Date(now - 17 * HOUR),
      endedAt: null,
      lastHeartbeatAt: new Date(now - 30_000),
      note: null,
      focusRating: null,
    });

    // BUG: validateSessionWindow() rejects (> 16h) and the frontend shows
    // only the generic "Could not stop the session" (or nothing at all when
    // stopped from the global pill), so the session can never be stopped.
    await expect(service.stop('u1', 's1', {})).resolves.toBeDefined();
    expect(db.row.endedAt).not.toBeNull();
  });
});

describe('[silent-audit a-01b] auto-close bypasses the 16h rule', () => {
  it('a session closed by autoCloseIfStale must respect MAX_SESSION_MINUTES like every other write', async () => {
    const now = Date.now();
    const { service, db } = setup({
      id: 's1',
      userId: 'u1',
      startedAt: new Date(now - 20 * HOUR),
      endedAt: null,
      // Last heartbeat 19h after start, then the tab was closed.
      lastHeartbeatAt: new Date(now - 1 * HOUR),
      note: null,
      focusRating: null,
    });

    await service.getActive('u1');

    expect(db.row.endedAt).not.toBeNull();
    const minutes =
      ((db.row.endedAt as Date).getTime() - db.row.startedAt.getTime()) /
      MINUTE;
    // BUG: 1140 minutes (19h) are silently credited to the heatmap, streak,
    // daily totals and the grade/duration predictions.
    expect(minutes).toBeLessThanOrEqual(16 * 60);
  });
});

describe('[silent-audit a-02] focus session on a locked phone', () => {
  // A 25 min Pomodoro started on a phone; the screen locks 1 min in, so the
  // page is frozen and no heartbeat is sent. The user comes back at 25 min.
  // On resume two requests race: the overdue heartbeat interval and the
  // visibilitychange -> syncActive() -> GET /study-sessions/active.
  function lockedPhone() {
    const now = Date.now();
    return setup({
      id: 's1',
      userId: 'u1',
      startedAt: new Date(now - 25 * MINUTE),
      endedAt: null,
      lastHeartbeatAt: new Date(now - 24 * MINUTE),
      note: null,
      focusRating: null,
    });
  }

  it('the outcome must not depend on which request reaches the server first', async () => {
    const a = lockedPhone();
    await a.service.getActive('u1'); // GET /active wins the race
    const b = lockedPhone();
    // heartbeat wins the race. Fixed: a stale heartbeat no longer revives
    // the session; it closes it and answers 404 (same as GET /active).
    await b.service.heartbeat('u1', 's1').catch(() => undefined);
    await b.service.getActive('u1');

    const outcomeA = a.db.row.endedAt === null ? 'running' : 'closed';
    const outcomeB = b.db.row.endedAt === null ? 'running' : 'closed';
    // BUG: A = closed at minute 1 (24 min of study lost, timer vanishes
    // without any message); B = still running (heartbeat revived it).
    expect(outcomeA).toBe(outcomeB);
  });

  it('a session the user is still timing must not be closed at the moment the phone locked', async () => {
    const a = lockedPhone();
    // Fixed flow: on resume the client first sends a heartbeat carrying the
    // planned block end (the 25 min block ends now), then GET /active. The
    // original test called GET /active alone, but without the plan the
    // server cannot tell a locked-phone Pomodoro from a forgotten tab.
    await a.service.heartbeat('u1', 's1', {
      plannedEndAt: new Date(
        a.db.row.startedAt.getTime() + 25 * MINUTE,
      ).toISOString(),
    });
    await a.service.getActive('u1');
    // BUG: closed with endedAt = lastHeartbeatAt (1 min into the block) and
    // the note "Auto-stopped..." - the frontend just sets activeSession=null.
    expect(a.db.row.endedAt).toBeNull();
  });

  it('a stale heartbeat outside any planned block closes the session deterministically', async () => {
    const a = lockedPhone();
    await expect(a.service.heartbeat('u1', 's1')).rejects.toThrow();
    expect(a.db.row.endedAt).not.toBeNull();
  });

  it('a planned block end far in the future cannot keep a forgotten session alive', async () => {
    const now = Date.now();
    const lastHeartbeatAt = new Date(now - 5 * HOUR);
    const { service, db } = setup({
      id: 's1',
      userId: 'u1',
      startedAt: new Date(now - 6 * HOUR),
      endedAt: null,
      lastHeartbeatAt,
      note: null,
      focusRating: null,
    });
    // Plan end is capped at start + 4 h (2 h ago), so the session is stale.
    await expect(
      service.heartbeat('u1', 's1', {
        plannedEndAt: new Date(now + HOUR).toISOString(),
      }),
    ).rejects.toThrow();
    expect(db.row.endedAt).toEqual(lastHeartbeatAt);
  });
});
