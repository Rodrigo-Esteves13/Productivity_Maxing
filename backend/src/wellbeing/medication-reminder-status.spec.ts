import { MedicationSchedule } from '@prisma/client';
import {
  computeReminderSlotStates,
  MedicationsService,
} from './medications.service';
import { MEDICATION_REMINDER_WINDOW_MINUTES } from './wellbeing.constants';
import type { PrismaService } from '../prisma/prisma.service';
import type { PushService } from '../push/push.service';
import type { MedicationDisclaimerService } from './medication-disclaimer.service';
import { getLisbonNow } from '../common/date-key.util';

jest.mock('../common/date-key.util', () => ({
  ...jest.requireActual<Record<string, unknown>>('../common/date-key.util'),
  getLisbonNow: jest.fn(),
}));

const SLOT = 420;
const W = MEDICATION_REMINDER_WINDOW_MINUTES;
const stateAt = (
  now: number,
  dose?: { takenAt?: Date | null; remindedAt?: Date | null },
) =>
  computeReminderSlotStates(
    [SLOT],
    dose
      ? [
          {
            slotMinutes: SLOT,
            takenAt: dose.takenAt ?? null,
            remindedAt: dose.remindedAt ?? null,
          },
        ]
      : [],
    now,
  )[0];

describe('computeReminderSlotStates', () => {
  it('upcoming before the slot', () => {
    expect(stateAt(SLOT - 1).state).toBe('upcoming');
  });

  it('due at the slot and at exactly the window edge', () => {
    expect(stateAt(SLOT).state).toBe('due');
    expect(stateAt(SLOT + W).state).toBe('due');
  });

  it('missed one minute past the window', () => {
    expect(stateAt(SLOT + W + 1).state).toBe('missed');
  });

  it('reminded with ISO timestamp', () => {
    const remindedAt = new Date('2026-01-01T07:15:00Z');
    const s = stateAt(SLOT + W + 30, { remindedAt });
    expect(s.state).toBe('reminded');
    expect(s.remindedAt).toBe(remindedAt.toISOString());
    expect(s.takenAt).toBeNull();
  });

  it('taken wins over reminded', () => {
    const takenAt = new Date('2026-01-01T07:20:00Z');
    const s = stateAt(SLOT + 10, { takenAt, remindedAt: new Date() });
    expect(s.state).toBe('taken');
    expect(s.takenAt).toBe(takenAt.toISOString());
  });

  it('ignores doses of other slots and sorts slots', () => {
    const out = computeReminderSlotStates(
      [600, SLOT],
      [{ slotMinutes: 999, takenAt: new Date(), remindedAt: null }],
      SLOT,
    );
    expect(out.map((s) => [s.slotMinutes, s.state])).toEqual([
      [SLOT, 'due'],
      [600, 'upcoming'],
    ]);
  });
});

describe('MedicationsService.reminderStatus', () => {
  it('queries only the caller, today, active daily reminders', async () => {
    const today = new Date('2026-01-01T00:00:00Z');
    (getLisbonNow as jest.Mock).mockReturnValue({
      today,
      nowMinutes: SLOT + 30,
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'm1',
        times: [SLOT],
        doses: [{ slotMinutes: SLOT, takenAt: null, remindedAt: null }],
      },
    ]);
    const service = new MedicationsService(
      { medication: { findMany } } as unknown as PrismaService,
      {} as PushService,
      {} as MedicationDisclaimerService,
    );
    const out = await service.reminderStatus('u1');
    const args = (findMany.mock.calls as unknown[][])[0][0] as {
      where: unknown;
      select: { doses: { where: unknown } };
    };
    expect(args.where).toEqual({
      userId: 'u1',
      active: true,
      remindersEnabled: true,
      schedule: MedicationSchedule.DAILY,
    });
    expect(args.select.doses.where).toEqual({ userId: 'u1', date: today });
    expect(out.windowMinutes).toBe(W);
    expect(out.medications[0].slots[0].state).toBe('due');
  });
});
