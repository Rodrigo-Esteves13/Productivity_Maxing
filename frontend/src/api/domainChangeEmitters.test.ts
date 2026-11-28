import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('./client', () => ({ default: client, refreshSession: vi.fn() }));

import {
  DOMAIN_CHANGE_SETTLE_MS,
  getDomainVersion,
  resetDomainEventsForTests,
  type DataDomain,
} from '../lib/domainEvents';
import {
  bulkUpdateTaskStatus,
  confirmOverdueTask,
  createTask,
  deleteTask,
  getUserTasks,
  updateTask,
} from './tasksService';
import { deleteArea } from './areasService';
import {
  createManualSession,
  deleteStudySession,
  getSessionHistory,
  stopStudySession,
  updateStudySession,
} from './studySessionsService';
import { addGradeEntry, removeGradeEntry, updateGradeComponent } from './gradeComponentsService';
import { createStreakFreeze, deleteStreakFreeze } from './streakFreezesService';
import { clearAreaTeacher, setAreaTeacher } from './areaTeachersService';
import { setAreaRating } from './areaRatingsService';

// Versao publicada do dominio depois de a janela de juntar avisos fechar.
function settledVersion(domain: DataDomain): number {
  vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
  return getDomainVersion(domain);
}

describe('services announce data changes to other cards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetDomainEventsForTests();
    for (const method of Object.values(client)) method.mockReset().mockResolvedValue({ data: { count: 1 } });
  });

  afterEach(() => {
    resetDomainEventsForTests();
    vi.useRealTimers();
  });

  it.each([
    ['createTask', () => createTask({ title: 'x' } as never)],
    ['updateTask', () => updateTask('t1', { progressStatus: 'COMPLETED' } as never)],
    ['deleteTask', () => deleteTask('t1')],
    ['bulkUpdateTaskStatus', () => bulkUpdateTaskStatus(['t1', 't2'], 'COMPLETED' as never)],
    ['confirmOverdueTask', () => confirmOverdueTask('t1', { isCompleted: true })],
    ['deleteArea', () => deleteArea('a1')],
  ])('%s bumps tasks', async (_name, call) => {
    await call();
    expect(settledVersion('tasks')).toBe(1);
  });

  it.each([
    ['createManualSession', () => createManualSession({ startedAt: 'a', endedAt: 'b' })],
    ['updateStudySession', () => updateStudySession('s1', { note: 'n' })],
    ['deleteStudySession', () => deleteStudySession('s1')],
    ['createStreakFreeze', () => createStreakFreeze()],
    ['deleteStreakFreeze', () => deleteStreakFreeze('f1')],
  ])('%s bumps studySessions', async (_name, call) => {
    await call();
    expect(settledVersion('studySessions')).toBe(1);
  });

  it.each([
    ['addGradeEntry', () => addGradeEntry('c1', { grade: 15 })],
    ['removeGradeEntry', () => removeGradeEntry('c1', 'e1')],
    ['updateGradeComponent', () => updateGradeComponent('c1', { weight: 40 } as never)],
  ])('%s bumps grades', async (_name, call) => {
    await call();
    expect(settledVersion('grades')).toBe(1);
  });

  it('teacher and rating writes bump their own domains', async () => {
    await setAreaTeacher('a1', 'Prof');
    await clearAreaTeacher('a1');
    await setAreaRating('a1', 'teacherRating', 4);
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainVersion('areaTeachers')).toBe(1);
    expect(getDomainVersion('ratings')).toBe(1);
  });

  it('stopping a session does not bump (useSessionEndKey already reacts)', async () => {
    await stopStudySession('s1');
    expect(settledVersion('studySessions')).toBe(0);
  });

  it('reads do not bump anything', async () => {
    client.get.mockResolvedValue({ data: [] });
    await getSessionHistory(14);
    await getUserTasks().catch(() => undefined);
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainVersion('tasks')).toBe(0);
    expect(getDomainVersion('studySessions')).toBe(0);
  });

  it('a failed write does not bump', async () => {
    client.delete.mockRejectedValue(new Error('boom'));
    await expect(deleteTask('t1')).rejects.toThrow('boom');
    await expect(deleteStudySession('s1')).rejects.toThrow('boom');
    vi.advanceTimersByTime(DOMAIN_CHANGE_SETTLE_MS);
    expect(getDomainVersion('tasks')).toBe(0);
    expect(getDomainVersion('studySessions')).toBe(0);
  });

  it('a bulk action that saved nothing does not bump', async () => {
    client.patch.mockResolvedValue({ data: { count: 0 } });
    await bulkUpdateTaskStatus(['t1'], 'COMPLETED' as never);
    expect(settledVersion('tasks')).toBe(0);
  });
});
