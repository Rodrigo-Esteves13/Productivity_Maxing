import { formatDayLabel } from '../../../lib/timeFormat';
import type { CopyWeekMode, CopyWeekResult } from '../../../types/models';
import { translateNow } from '../../../i18n/translate';

// Semanas oferecidas: 8 para trás (copiar de) e a atual + 7 para a frente.
export const SOURCE_WEEKS = { firstOffset: -8, count: 8 };
export const TARGET_WEEKS = { firstOffset: 0, count: 8 };

const RELATIVE_WEEK_KEY: Record<number, string> = {
  [-1]: 'copyWeek.lastWeek',
  0: 'copyWeek.thisWeek',
  1: 'copyWeek.nextWeek',
};

export function describeWeek(weekStartKey: string, weeksFromNow: number): string {
  const relativeKey = RELATIVE_WEEK_KEY[weeksFromNow];
  const start = formatDayLabel(weekStartKey);
  return relativeKey
    ? translateNow('copyWeek.weekOfRelative', { start, relative: translateNow(relativeKey) })
    : translateNow('copyWeek.weekOf', { start });
}

export const MODE_OPTIONS: { value: CopyWeekMode; label: string; hint: string }[] = [
  {
    value: 'one-off',
    get label() { return translateNow('copyWeek.oneOffLabel'); },
    get hint() { return translateNow('copyWeek.oneOffHint'); },
  },
  {
    value: 'fixed',
    get label() { return translateNow('copyWeek.fixedLabel'); },
    get hint() { return translateNow('copyWeek.fixedHint'); },
  },
];

// Texto do resultado. Ordem: nada na origem, tudo já existia, criou algo.
export function describeCopyResult(result: CopyWeekResult): string {
  if (result.sourceCount === 0) {
    return translateNow('copyWeek.nothingToCopy');
  }
  const created = result.created.length;
  const dayOff = result.dayOffSkipped ?? 0;
  const dayOffNote = dayOff > 0 ? ` ${translateNow('copyWeek.dayOffSkipped', { count: dayOff })}` : '';
  if (created === 0) {
    return `${translateNow('copyWeek.nothingAdded')}${dayOffNote}`;
  }
  const skipped =
    result.skipped > 0 ? ` ${translateNow('copyWeek.alreadyThereSkipped', { count: result.skipped })}` : '';
  return `${translateNow(created === 1 ? 'copyWeek.addedOne' : 'copyWeek.addedMany', { count: created })}${skipped}.${dayOffNote}`;
}
