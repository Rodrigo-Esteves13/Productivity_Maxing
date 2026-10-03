import { formatDayLabel } from '../../../lib/timeFormat';
import type { CopyWeekMode, CopyWeekResult } from '../../../types/models';

// Semanas oferecidas: 8 para trás (copiar de) e a atual + 7 para a frente.
export const SOURCE_WEEKS = { firstOffset: -8, count: 8 };
export const TARGET_WEEKS = { firstOffset: 0, count: 8 };

const RELATIVE_WEEK_LABEL: Record<number, string> = {
  [-1]: 'last week',
  0: 'this week',
  1: 'next week',
};

export function describeWeek(weekStartKey: string, weeksFromNow: number): string {
  const relative = RELATIVE_WEEK_LABEL[weeksFromNow];
  const start = formatDayLabel(weekStartKey);
  return relative ? `Week of ${start} (${relative})` : `Week of ${start}`;
}

export const MODE_OPTIONS: { value: CopyWeekMode; label: string; hint: string }[] = [
  {
    value: 'one-off',
    label: 'Copy into another week',
    hint: 'Adds the same one-day shifts to the week you pick. Nothing repeats after that.',
  },
  {
    value: 'fixed',
    label: 'Make them fixed',
    hint: 'Turns them into shifts that repeat every week. You can delete any of them later.',
  },
];

function plural(count: number): string {
  return count === 1 ? 'shift' : 'shifts';
}

// Texto do resultado. Ordem: nada na origem, tudo já existia, criou algo.
export function describeCopyResult(result: CopyWeekResult): string {
  if (result.sourceCount === 0) {
    return 'That week has no one-day shifts to copy. Fixed shifts already apply to every week.';
  }
  const created = result.created.length;
  if (created === 0) {
    return 'Everything from that week is already there. Nothing was added.';
  }
  const skipped =
    result.skipped > 0 ? ` (${result.skipped} already there, skipped)` : '';
  return `Added ${created} ${plural(created)}${skipped}.`;
}
