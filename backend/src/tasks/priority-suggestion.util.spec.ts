import {
  DateCertainty,
  Difficulty,
  Effort,
  ProgressStatus,
} from '@prisma/client';
import {
  PrioritySuggestionInput,
  SUGGESTED_PRIORITY,
  suggestPriorityKey,
} from './priority-suggestion.util';

const NOW = new Date('2026-05-01T12:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

const base: PrioritySuggestionInput = {
  date: days(30),
  dateCertainty: DateCertainty.EXACT,
  progressStatus: ProgressStatus.ON_TRACK,
  postponedCount: 0,
  weightPercentage: null,
  difficulty: Difficulty.MEDIUM,
  effort: null,
};

describe('suggestPriorityKey', () => {
  it('suggests LOW for a far, light task', () => {
    expect(suggestPriorityKey(base, null, NOW)).toBe(SUGGESTED_PRIORITY.LOW);
  });

  it('suggests HIGH for a near, heavy, postponed task', () => {
    const t = {
      ...base,
      date: days(1),
      postponedCount: 3,
      weightPercentage: 40,
      difficulty: Difficulty.HARD,
    };
    expect(suggestPriorityKey(t, null, NOW)).toBe(SUGGESTED_PRIORITY.HIGH);
  });

  it('suggests MEDIUM for a deadline within a week', () => {
    const t = { ...base, date: days(5), effort: Effort.HEAVY };
    expect(suggestPriorityKey(t, null, NOW)).toBe(SUGGESTED_PRIORITY.MEDIUM);
  });

  it('ignores the deadline when the date is not firm', () => {
    const t = { ...base, date: days(1), dateCertainty: DateCertainty.UNKNOWN };
    expect(suggestPriorityKey(t, null, NOW)).toBe(SUGGESTED_PRIORITY.LOW);
  });

  it('returns null when it equals the current priority', () => {
    expect(suggestPriorityKey(base, 'LOW', NOW)).toBeNull();
  });

  it('returns null for completed tasks', () => {
    const t = { ...base, progressStatus: ProgressStatus.COMPLETED };
    expect(suggestPriorityKey(t, null, NOW)).toBeNull();
  });
});
