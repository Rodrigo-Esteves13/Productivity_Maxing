import { AGAIN_DELAY_MS, scheduleReview } from './flashcard-schedule';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const DAY = 86_400_000;
const card = (over = {}) => ({
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  ...over,
});

describe('scheduleReview', () => {
  it('AGAIN resets reps, adds lapse, lowers ease, due in 10 min', () => {
    const r = scheduleReview(card({ reps: 4, intervalDays: 20 }), 'AGAIN', NOW);
    expect(r).toMatchObject({ reps: 0, lapses: 1, intervalDays: 0, ease: 2.3 });
    expect(r.dueAt.getTime()).toBe(NOW.getTime() + AGAIN_DELAY_MS);
  });

  it('AGAIN never drops ease below 1.3', () => {
    expect(scheduleReview(card({ ease: 1.35 }), 'AGAIN', NOW).ease).toBe(1.3);
  });

  it('GOOD goes 1 day, 3 days, then interval x ease', () => {
    const first = scheduleReview(card(), 'GOOD', NOW);
    expect(first).toMatchObject({ intervalDays: 1, reps: 1, ease: 2.5 });
    const second = scheduleReview(
      card({ reps: 1, intervalDays: 1 }),
      'GOOD',
      NOW,
    );
    expect(second.intervalDays).toBe(3);
    const third = scheduleReview(
      card({ reps: 2, intervalDays: 3 }),
      'GOOD',
      NOW,
    );
    expect(third.intervalDays).toBe(8);
    expect(third.dueAt.getTime()).toBe(NOW.getTime() + 8 * DAY);
  });

  it('EASY multiplies by 1.3 and raises ease', () => {
    const r = scheduleReview(card({ reps: 2, intervalDays: 10 }), 'EASY', NOW);
    expect(r.intervalDays).toBe(Math.round(25 * 1.3));
    expect(r.ease).toBeCloseTo(2.65);
    expect(r.reps).toBe(3);
    expect(scheduleReview(card(), 'EASY', NOW).intervalDays).toBe(1);
  });

  it('keeps lapses on success', () => {
    expect(scheduleReview(card({ lapses: 2 }), 'GOOD', NOW).lapses).toBe(2);
  });
});
