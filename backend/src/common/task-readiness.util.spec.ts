import { ProgressStatus } from '@prisma/client';
import { effectiveProgressStatus, isTaskLocked } from './task-readiness.util';

const NOW = new Date('2026-05-01T12:00:00Z');
const later = new Date('2026-06-01T00:00:00Z');
const earlier = new Date('2026-04-01T00:00:00Z');

describe('effectiveProgressStatus', () => {
  const t = (over: object) => ({
    progressStatus: ProgressStatus.ON_TRACK,
    isBlocked: false,
    availableFrom: null,
    ...over,
  });

  it('shows NOT_STARTED when blocked', () => {
    expect(effectiveProgressStatus(t({ isBlocked: true }), NOW)).toBe(
      ProgressStatus.NOT_STARTED,
    );
  });
  it('shows NOT_STARTED before availableFrom', () => {
    expect(effectiveProgressStatus(t({ availableFrom: later }), NOW)).toBe(
      ProgressStatus.NOT_STARTED,
    );
  });
  it('returns the stored status once unlocked', () => {
    expect(effectiveProgressStatus(t({ availableFrom: earlier }), NOW)).toBe(
      ProgressStatus.ON_TRACK,
    );
  });
  it('never overrides COMPLETED', () => {
    expect(
      effectiveProgressStatus(
        t({ progressStatus: ProgressStatus.COMPLETED, isBlocked: true }),
        NOW,
      ),
    ).toBe(ProgressStatus.COMPLETED);
  });
  it('isTaskLocked is false for a free task', () => {
    expect(isTaskLocked({ isBlocked: false, availableFrom: null }, NOW)).toBe(
      false,
    );
  });
});
