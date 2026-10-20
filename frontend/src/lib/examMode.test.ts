import { describe, expect, it } from 'vitest';
import { examModeVisibility, isExamTask, upcomingExams } from './examMode';
import type { Task } from '../types/models';
import type { DashboardWidgetKey } from '../hooks/useDashboardWidgetPrefs';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't',
    date: '2026-10-25T00:00:00.000Z',
    progressStatus: 'ON_TRACK',
    academicTypeIsEvent: true,
    ...overrides,
  } as unknown as Task;
}

describe('upcomingExams', () => {
  it('keeps pending tests and exams from today on, soonest first', () => {
    const exams = upcomingExams(
      [
        makeTask({ id: 'late', date: '2026-11-02T00:00:00.000Z' }),
        makeTask({ id: 'today', date: '2026-10-20T00:00:00.000Z' }),
        makeTask({ id: 'past', date: '2026-10-19T00:00:00.000Z' }),
        makeTask({ id: 'done', progressStatus: 'COMPLETED' }),
        makeTask({ id: 'report', academicTypeIsEvent: false }),
      ],
      '2026-10-20',
    );
    expect(exams.map((task) => task.id)).toEqual(['today', 'late']);
  });

  it('treats a missing flag as not an exam', () => {
    expect(isExamTask(makeTask({ academicTypeIsEvent: undefined }))).toBe(false);
  });
});

describe('examModeVisibility', () => {
  it('hides every card except Today, and keeps Today hidden if the user hid it', () => {
    const visibility = { today: true, upcoming: true, examCountdown: true } as Record<DashboardWidgetKey, boolean>;
    expect(examModeVisibility(visibility)).toEqual({ today: true, upcoming: false, examCountdown: false });
    expect(examModeVisibility({ ...visibility, today: false }).today).toBe(false);
  });
});
