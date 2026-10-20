import { describe, expect, it } from 'vitest';
import { currentOrNextAgendaItem, minutesSinceMidnight, nextStudyBlock } from './todayOverview';
import type { AgendaItem } from './agenda';
import type { StudyPlanSuggestion } from '../types/models';

const item = (id: string, startMinutes: number, endMinutes: number) =>
  ({ kind: 'class', id, startMinutes, endMinutes }) as unknown as AgendaItem;

const block = (taskId: string, date: string, startMinutes: number, endMinutes: number) =>
  ({ taskId, date, startMinutes, endMinutes }) as unknown as StudyPlanSuggestion;

describe('currentOrNextAgendaItem', () => {
  const items = [item('a', 540, 630), item('b', 840, 960)];

  it('returns the item happening now, then the next one, then null', () => {
    expect(currentOrNextAgendaItem(items, 600)?.id).toBe('a');
    expect(currentOrNextAgendaItem(items, 630)?.id).toBe('b');
    expect(currentOrNextAgendaItem(items, 960)).toBeNull();
  });
});

describe('nextStudyBlock', () => {
  it('only looks at blocks of today that have not ended', () => {
    const blocks = [
      block('tomorrow', '2026-10-21', 600, 660),
      block('later', '2026-10-20', 1080, 1140),
      block('earlier', '2026-10-20', 480, 540),
    ];
    expect(nextStudyBlock(blocks, '2026-10-20', 600)?.taskId).toBe('later');
    expect(nextStudyBlock(blocks, '2026-10-20', 1140)).toBeNull();
  });
});

describe('minutesSinceMidnight', () => {
  it('uses the local clock', () => {
    expect(minutesSinceMidnight(new Date(2026, 9, 20, 14, 35))).toBe(875);
  });
});
