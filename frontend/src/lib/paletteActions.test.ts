import { describe, expect, it } from 'vitest';
import type { Task } from '../types/models';
import {
  actionForKey,
  canPostponeToTomorrow,
  paletteTaskActions,
  resolveAction,
  shortcutLabel,
} from './paletteActions';

const NOW = new Date('2026-05-10T10:00:00.000Z');
const open: Pick<Task, 'progressStatus' | 'date'> = { progressStatus: 'ON_TRACK', date: '2026-05-10T00:00:00.000Z' };
const idle = { hasActiveSession: false, now: NOW };

const ids = (task = open, context = idle) => paletteTaskActions(task, context).map((action) => action.id);

const key = (init: Partial<Parameters<typeof actionForKey>[0]>) =>
  actionForKey({ key: 'Enter', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...init });

describe('paletteTaskActions', () => {
  it('offers done, postpone and focus on an open task', () => {
    expect(ids()).toEqual(['done', 'postpone', 'focus']);
  });

  it('offers nothing on a completed task', () => {
    expect(ids({ ...open, progressStatus: 'COMPLETED' })).toEqual([]);
  });

  it('hides focus while a study session is running', () => {
    expect(ids(open, { ...idle, hasActiveSession: true })).toEqual(['done', 'postpone']);
  });

  it('hides postpone when the task is already tomorrow or later', () => {
    expect(ids({ ...open, date: '2026-05-11T00:00:00.000Z' })).toEqual(['done', 'focus']);
    expect(ids({ ...open, date: '2026-06-01T00:00:00.000Z' })).toEqual(['done', 'focus']);
  });

  it('keeps postpone for overdue tasks', () => {
    expect(canPostponeToTomorrow({ date: '2026-04-01T00:00:00.000Z' }, NOW)).toBe(true);
  });

  it('does not offer postpone for an invalid date', () => {
    expect(canPostponeToTomorrow({ date: 'nope' }, NOW)).toBe(false);
  });
});

describe('actionForKey', () => {
  it('leaves a plain Enter alone (opens the task)', () => {
    expect(key({})).toBeNull();
  });

  it('maps the modified Enter combinations', () => {
    expect(key({ ctrlKey: true })).toBe('done');
    expect(key({ metaKey: true })).toBe('done');
    expect(key({ shiftKey: true })).toBe('postpone');
    expect(key({ ctrlKey: true, shiftKey: true })).toBe('focus');
    expect(key({ metaKey: true, shiftKey: true })).toBe('focus');
  });

  it('ignores other keys and Alt+Enter', () => {
    expect(key({ key: 'a', ctrlKey: true })).toBeNull();
    expect(key({ altKey: true })).toBeNull();
  });
});

describe('resolveAction', () => {
  it('returns the action when available', () => {
    expect(resolveAction(open, 'done', idle)).toBe('done');
  });

  it('drops an action that is not offered for that task', () => {
    expect(resolveAction({ ...open, progressStatus: 'COMPLETED' }, 'done', idle)).toBeNull();
    expect(resolveAction(open, 'focus', { ...idle, hasActiveSession: true })).toBeNull();
    expect(resolveAction(open, null, idle)).toBeNull();
  });
});

describe('shortcutLabel', () => {
  it('writes the shortcut per platform', () => {
    expect(shortcutLabel({ mod: true, shift: false }, false)).toBe('Ctrl+Enter');
    expect(shortcutLabel({ mod: true, shift: true }, true)).toBe('Cmd+Shift+Enter');
    expect(shortcutLabel({ mod: false, shift: true }, false)).toBe('Shift+Enter');
  });
});
