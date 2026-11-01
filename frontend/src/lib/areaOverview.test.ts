import { describe, expect, it } from 'vitest';
import { buildAreaOverview } from './areaOverview';
import type { AreaTeacherNote, CourseRiskOverview, Task } from '../types/models';

const NOW = new Date('2026-05-10T12:00:00.000Z');

function task(over: Partial<Task>): Task {
  return {
    id: 't',
    areaId: 'a1',
    date: '2026-05-20T00:00:00.000Z',
    progressStatus: 'NOT_STARTED',
    dateCertainty: 'EXACT',
    ...over,
  } as Task;
}

describe('buildAreaOverview', () => {
  it('counts open and overdue, ignores completed', () => {
    const map = buildAreaOverview(
      [
        task({ id: '1', date: '2026-05-01T00:00:00.000Z' }),
        task({ id: '2', date: '2026-05-01T00:00:00.000Z', progressStatus: 'COMPLETED' }),
        task({ id: '3' }),
        task({ id: '4', areaId: 'a2' }),
      ],
      null,
      null,
      NOW,
    );
    expect(map.get('a1')).toMatchObject({ openTasks: 2, overdueTasks: 1 });
    expect(map.get('a2')).toMatchObject({ openTasks: 1, overdueTasks: 0 });
  });

  it('picks the nearest non-overdue firm deadline', () => {
    const map = buildAreaOverview(
      [
        task({ id: '1', date: '2026-05-01T00:00:00.000Z' }),
        task({ id: '2', date: '2026-06-01T00:00:00.000Z' }),
        task({ id: '3', date: '2026-05-15T00:00:00.000Z' }),
      ],
      null,
      null,
      NOW,
    );
    expect(map.get('a1')?.nextDeadline).toBe('2026-05-15T00:00:00.000Z');
  });

  it('never marks unknown/surprise dates overdue or as next deadline', () => {
    const map = buildAreaOverview(
      [
        task({ id: '1', date: '2026-05-01T00:00:00.000Z', dateCertainty: 'UNKNOWN' }),
        task({ id: '2', date: '2026-05-12T00:00:00.000Z', dateCertainty: 'SURPRISE' }),
      ],
      null,
      null,
      NOW,
    );
    expect(map.get('a1')).toMatchObject({ openTasks: 2, overdueTasks: 0, nextDeadline: null });
  });

  it('merges risk and teacher, tolerates missing sources', () => {
    const risk = {
      courses: [
        { areaId: 'a1', risk: { level: 'high', score: 72, currentAverage: 9.5 } },
        { areaId: 'a3', risk: null },
      ],
    } as unknown as CourseRiskOverview;
    const teachers: AreaTeacherNote[] = [
      { areaId: 'a1', teacherName: ' Ana ', autoFromSchedule: false },
      { areaId: 'a3', teacherName: '  ', autoFromSchedule: false },
    ];
    const map = buildAreaOverview(null, risk, teachers, NOW);
    expect(map.get('a1')).toMatchObject({
      riskLevel: 'high',
      riskScore: 72,
      currentAverage: 9.5,
      teacherName: 'Ana',
      openTasks: 0,
    });
    expect(map.get('a3')).toMatchObject({ riskLevel: null, teacherName: null });
    expect(buildAreaOverview(null, null, null, NOW).size).toBe(0);
  });
});
