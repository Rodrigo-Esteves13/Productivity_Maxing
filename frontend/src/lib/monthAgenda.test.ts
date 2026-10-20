import { describe, expect, it } from 'vitest';
import { buildDeadlineChips, buildMonthAgenda, chipTones } from './monthAgenda';
import type { ClassOccurrence, Task, WorkShiftOccurrence } from '../types/models';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Report',
    date: '2026-10-20T00:00:00.000Z',
    progressStatus: 'ON_TRACK',
    academicTypeIsEvent: false,
    ...overrides,
  } as unknown as Task;
}

function makeClass(overrides: Partial<ClassOccurrence>): ClassOccurrence {
  return {
    id: 'c1',
    date: '2026-10-20T00:00:00.000Z',
    startMinutes: 540,
    endMinutes: 630,
    subject: 'Networks',
    location: null,
    ...overrides,
  } as unknown as ClassOccurrence;
}

const shift: WorkShiftOccurrence = {
  shiftId: 's1',
  commitmentId: 'w1',
  date: '2026-10-20',
  startMinutes: 480,
  endMinutes: 600,
  bufferMinutes: 0,
  label: null,
  isRecurring: true,
};

describe('buildMonthAgenda', () => {
  it('puts deadlines first, exams ahead, then classes and shifts by time', () => {
    const chips = buildMonthAgenda(
      [
        makeTask({ id: 'done', progressStatus: 'COMPLETED' }),
        makeTask({ id: 'report' }),
        makeTask({ id: 'exam', title: 'Calculus exam', academicTypeIsEvent: true }),
      ],
      [makeClass({})],
      [shift],
    ).get('2026-10-20');

    expect(chips?.map((chip) => chip.id)).toEqual([
      'task-exam',
      'task-report',
      'task-done',
      'shift-s1-2026-10-20',
      'class-c1',
    ]);
    expect(chips?.[0].tone).toBe('exam');
    expect(chips?.[2].done).toBe(true);
    expect(chips?.[3]).toMatchObject({ tone: 'work', label: null, time: '08:00-10:00' });
    expect(chips?.[4]).toMatchObject({ tone: 'class', label: 'Networks', time: '09:00-10:30' });
  });

  it('groups by day and leaves empty days out', () => {
    const agenda = buildMonthAgenda([makeTask({ date: '2026-10-21T23:30:00.000Z' })], [], []);
    expect([...agenda.keys()]).toEqual(['2026-10-21']);
  });
});

describe('buildDeadlineChips', () => {
  it('keeps only deadlines, exams first, each with its task id', () => {
    const chips = buildDeadlineChips([
      makeTask({ id: 'report' }),
      makeTask({ id: 'exam', academicTypeIsEvent: true }),
    ]).get('2026-10-20');
    expect(chips?.map((chip) => [chip.tone, chip.taskId])).toEqual([
      ['exam', 'exam'],
      ['deadline', 'report'],
    ]);
  });
});

describe('chipTones', () => {
  it('lists each tone once in legend order', () => {
    const chips = buildMonthAgenda(
      [makeTask({ id: 'a' }), makeTask({ id: 'b', academicTypeIsEvent: true })],
      [makeClass({}), makeClass({ id: 'c2' })],
      [],
    ).get('2026-10-20');
    expect(chipTones(chips ?? [])).toEqual(['exam', 'deadline', 'class']);
  });
});
