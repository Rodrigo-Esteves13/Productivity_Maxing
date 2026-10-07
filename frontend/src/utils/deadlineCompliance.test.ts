import { describe, expect, it } from 'vitest';
import { wasCompletedOnTime } from './deadlineCompliance';
import type { Task } from '../types/models';

function makeTask(overrides: Partial<Task>): Task {
  return {
    progressStatus: 'COMPLETED',
    date: '2026-10-06T00:00:00.000Z',
    completedAt: '2026-10-07T09:00:00.000Z',
    academicTypeIsEvent: false,
    ...overrides,
  } as unknown as Task;
}

describe('wasCompletedOnTime', () => {
  it('uma entrega marcada como feita depois do dia conta como atrasada', () => {
    expect(wasCompletedOnTime(makeTask({}))).toBe(false);
  });

  it('um teste (evento) marcado como feito no dia seguinte conta como pontual', () => {
    expect(wasCompletedOnTime(makeTask({ academicTypeIsEvent: true }))).toBe(true);
  });

  it('um evento sem completedAt tambem conta como pontual', () => {
    expect(
      wasCompletedOnTime(makeTask({ academicTypeIsEvent: true, completedAt: null })),
    ).toBe(true);
  });

  it('entrega terminada durante o proprio dia (so data) e pontual', () => {
    expect(
      wasCompletedOnTime(makeTask({ completedAt: '2026-10-06T18:00:00.000Z' })),
    ).toBe(true);
  });

  it('tarefas por concluir nao tem veredicto', () => {
    expect(wasCompletedOnTime(makeTask({ progressStatus: 'ON_TRACK' }))).toBeNull();
    expect(
      wasCompletedOnTime(makeTask({ progressStatus: 'ON_TRACK', academicTypeIsEvent: true })),
    ).toBeNull();
  });

  it('entrega concluida sem completedAt nao tem veredicto', () => {
    expect(wasCompletedOnTime(makeTask({ completedAt: null }))).toBeNull();
  });
});
