// Regression tests for medication reminder bugs found in the silent-bug
// audit (area d: D-01 midnight window, D-02 untick cancels reminder). They use an in-memory fake
// of the few Prisma calls MedicationsService makes, and fake timers to move
// the Lisbon clock (getLisbonNow reads new Date()).
import { MedicationsService } from './medications.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { MedicationDisclaimerService } from './medication-disclaimer.service';

interface DoseRow {
  userId: string;
  medicationId: string;
  date: Date;
  slotMinutes: number;
  remindedAt: Date | null;
  takenAt: Date | null;
}

type Where = Record<string, unknown>;

function matches(row: Record<string, unknown>, where: Where | undefined) {
  if (!where) return true;
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Where[]).some((w) => matches(row, w));
    const value = row[key];
    if (cond instanceof Date) {
      return value instanceof Date && value.getTime() === cond.getTime();
    }
    if (cond && typeof cond === 'object' && 'not' in cond) {
      return cond.not === null ? value !== null : value !== cond.not;
    }
    return value === cond;
  });
}

function setup(times: number[]) {
  const medication = {
    id: 'm1',
    userId: 'u1',
    name: 'Med',
    times,
  };
  const doses: DoseRow[] = [];
  const prisma = {
    medication: {
      findMany: jest.fn((args: { select: { doses: { where: Where } } }) =>
        Promise.resolve([
          {
            ...medication,
            doses: doses
              .filter(
                (d) =>
                  d.medicationId === medication.id &&
                  matches(
                    d as unknown as Record<string, unknown>,
                    args.select.doses.where,
                  ),
              )
              .map((d) => ({ slotMinutes: d.slotMinutes })),
          },
        ]),
      ),
      findFirst: jest.fn(() => Promise.resolve({ times: medication.times })),
    },
    medicationDose: {
      createMany: jest.fn(({ data }: { data: Omit<DoseRow, 'takenAt'>[] }) => {
        for (const row of data) {
          const dup = doses.some(
            (d) =>
              d.medicationId === row.medicationId &&
              d.date.getTime() === row.date.getTime() &&
              d.slotMinutes === row.slotMinutes,
          );
          if (!dup) doses.push({ ...row, takenAt: null });
        }
        return Promise.resolve({ count: data.length });
      }),
      upsert: jest.fn(
        ({
          where,
          create,
          update,
        }: {
          where: {
            medicationId_date_slotMinutes: {
              medicationId: string;
              date: Date;
              slotMinutes: number;
            };
          };
          create: Omit<DoseRow, 'remindedAt'>;
          update: { takenAt: Date | null };
        }) => {
          const key = where.medicationId_date_slotMinutes;
          const found = doses.find(
            (d) =>
              d.medicationId === key.medicationId &&
              d.date.getTime() === key.date.getTime() &&
              d.slotMinutes === key.slotMinutes,
          );
          if (found) Object.assign(found, update);
          else doses.push({ remindedAt: null, ...create });
          return Promise.resolve({});
        },
      ),
    },
  };
  const push = { notifyUser: jest.fn().mockResolvedValue(1) };
  const service = new MedicationsService(
    prisma as unknown as PrismaService,
    push as unknown as PushService,
    {
      assertAccepted: jest.fn().mockResolvedValue(undefined),
    } as unknown as MedicationDisclaimerService,
  );
  return { service, push, doses };
}

describe('medication reminders (regression, area d)', () => {
  afterEach(() => jest.useRealTimers());

  // Control (passes): proves the fake harness reminds a normal dose.
  it('control: a dose at 08:00 is reminded at 08:15', async () => {
    const { service, push } = setup([8 * 60]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T08:15:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  // D-01: the cron runs every 15 minutes (:00, :15, :30, :45). A dose at
  // 23:50 Lisbon is not due at 23:45 (late < 0) and at 00:00 the day has
  // changed (nowMinutes = 0, "today" = next day), so it is never reminded.
  it('D-01: a dose at 23:50 is reminded by some cron run around midnight', async () => {
    const { service, push } = setup([23 * 60 + 50]);
    jest.useFakeTimers();
    // December: Lisbon = UTC, so these are Lisbon wall-clock times too.
    const runs = [
      '2026-12-01T23:45:00Z',
      '2026-12-02T00:00:00Z',
      '2026-12-02T00:15:00Z',
      '2026-12-02T00:30:00Z',
      '2026-12-02T00:45:00Z',
    ];
    for (const at of runs) {
      jest.setSystemTime(new Date(at));
      await service.sendDueReminders();
    }
    expect(push.notifyUser).toHaveBeenCalled();
  });

  // D-02: ticking a future dose by mistake and unticking it leaves a dose
  // row with takenAt = null and remindedAt = null. findDueDoses treats ANY
  // row as "already reminded or taken", so the reminder never fires.
  it('D-02: unticking a dose before its time does not cancel its reminder', async () => {
    const { service, push } = setup([8 * 60]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T07:00:00Z')); // 07:00 Lisbon
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 480,
      taken: true,
    });
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 480,
      taken: false,
    });
    jest.setSystemTime(new Date('2026-12-01T08:05:00Z')); // 08:05 Lisbon
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('D-02: after an untick the reminder fires once, not on every cron run', async () => {
    const { service, push, doses } = setup([8 * 60]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T07:00:00Z'));
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 480,
      taken: true,
    });
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 480,
      taken: false,
    });
    for (const at of ['08:00', '08:15', '08:30', '08:45', '09:00']) {
      jest.setSystemTime(new Date(`2026-12-01T${at}:00Z`));
      await service.sendDueReminders();
    }
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(doses).toHaveLength(1);
    expect(doses[0].remindedAt).toBeInstanceOf(Date);
  });

  it('a dose ticked as taken is not reminded', async () => {
    const { service, push } = setup([8 * 60]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T07:55:00Z'));
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 480,
      taken: true,
    });
    jest.setSystemTime(new Date('2026-12-01T08:15:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it("D-01: the 23:50 dose is reminded once, on yesterday's date", async () => {
    const { service, push, doses } = setup([23 * 60 + 50]);
    jest.useFakeTimers();
    for (const at of [
      '2026-12-01T23:45:00Z',
      '2026-12-02T00:00:00Z',
      '2026-12-02T00:15:00Z',
      '2026-12-02T00:30:00Z',
      '2026-12-02T00:45:00Z',
    ]) {
      jest.setSystemTime(new Date(at));
      await service.sendDueReminders();
    }
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(doses).toHaveLength(1);
    expect(doses[0].date.toISOString()).toBe('2026-12-01T00:00:00.000Z');
  });

  it('D-01: a delayed cron run after midnight still reminds a 23:30 dose', async () => {
    const { service, push } = setup([23 * 60 + 30]);
    jest.useFakeTimers();
    // 23:15 run: not due yet. Next run delayed by GitHub to 00:25.
    jest.setSystemTime(new Date('2026-12-01T23:15:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).not.toHaveBeenCalled();
    jest.setSystemTime(new Date('2026-12-02T00:25:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
  });

  it('D-01: no reminder once the 60 minute window has passed', async () => {
    const { service, push } = setup([23 * 60 + 50]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-02T00:55:00Z')); // 65 min late
    await service.sendDueReminders();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('D-01: a 23:50 dose already taken yesterday is not reminded after midnight', async () => {
    const { service, push } = setup([23 * 60 + 50]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T23:48:00Z'));
    await service.setDose('u1', 'm1', {
      date: '2026-12-01',
      slotMinutes: 1430,
      taken: true,
    });
    jest.setSystemTime(new Date('2026-12-02T00:00:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).not.toHaveBeenCalled();
  });

  it('D-01: works in summer time (Lisbon = UTC+1)', async () => {
    const { service, push, doses } = setup([23 * 60 + 50]);
    jest.useFakeTimers();
    // 00:05 on 16 July in Lisbon.
    jest.setSystemTime(new Date('2026-07-15T23:05:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(doses[0].date.toISOString()).toBe('2026-07-15T00:00:00.000Z');
  });

  it('a 00:00 dose belongs to the new day and is reminded at 00:00', async () => {
    const { service, push, doses } = setup([0]);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-02T00:00:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(1);
    expect(doses[0].date.toISOString()).toBe('2026-12-02T00:00:00.000Z');
  });

  it('no device: nothing is marked, so the next run tries again', async () => {
    const { service, push, doses } = setup([8 * 60]);
    push.notifyUser.mockResolvedValueOnce(0);
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-12-01T08:00:00Z'));
    await service.sendDueReminders();
    expect(doses).toHaveLength(0);
    jest.setSystemTime(new Date('2026-12-01T08:15:00Z'));
    await service.sendDueReminders();
    expect(push.notifyUser).toHaveBeenCalledTimes(2);
    expect(doses).toHaveLength(1);
  });
});
