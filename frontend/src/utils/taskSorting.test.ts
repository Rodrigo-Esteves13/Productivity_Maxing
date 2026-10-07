import { describe, expect, it } from 'vitest';
import { isSortableColumn, sortTasks } from './taskSorting';
import type { Task } from '../types/models';

// So os campos que a ordenacao le; o resto do Task nao interessa aqui.
function makeTask(overrides: Partial<Task> & { id: string }): Task {
  return {
    title: overrides.id,
    date: '2026-10-10T00:00:00.000Z',
    difficulty: 'MEDIUM',
    progressStatus: 'ON_TRACK',
    priorityOrder: null,
    realGrade: null,
    academicType: null,
    area: { name: 'A' },
    ...overrides,
  } as unknown as Task;
}

const ids = (tasks: Task[]) => tasks.map((t) => t.id);

describe('sortTasks', () => {
  it('ordena por data crescente e decrescente', () => {
    const tasks = [
      makeTask({ id: 'b', date: '2026-10-12T00:00:00.000Z' }),
      makeTask({ id: 'a', date: '2026-10-10T00:00:00.000Z' }),
      makeTask({ id: 'c', date: '2026-10-11T00:00:00.000Z' }),
    ];
    expect(ids(sortTasks(tasks, 'date', 'asc'))).toEqual(['a', 'c', 'b']);
    expect(ids(sortTasks(tasks, 'date', 'desc'))).toEqual(['b', 'c', 'a']);
  });

  it('prioridade: menor priorityOrder primeiro em asc', () => {
    const tasks = [
      makeTask({ id: 'low', priorityOrder: 3 }),
      makeTask({ id: 'high', priorityOrder: 1 }),
      makeTask({ id: 'mid', priorityOrder: 2 }),
    ];
    expect(ids(sortTasks(tasks, 'priority', 'asc'))).toEqual(['high', 'mid', 'low']);
    expect(ids(sortTasks(tasks, 'priority', 'desc'))).toEqual(['low', 'mid', 'high']);
  });

  it('tasks sem prioridade ficam sempre no fim, em qualquer direcao', () => {
    const tasks = [
      makeTask({ id: 'none', priorityOrder: null }),
      makeTask({ id: 'high', priorityOrder: 1 }),
      makeTask({ id: 'low', priorityOrder: 3 }),
    ];
    expect(ids(sortTasks(tasks, 'priority', 'asc')).at(-1)).toBe('none');
    expect(ids(sortTasks(tasks, 'priority', 'desc')).at(-1)).toBe('none');
  });

  it('dificuldade usa a ordem natural, nao a alfabetica', () => {
    const tasks = [
      makeTask({ id: 'vh', difficulty: 'VERY_HARD' }),
      makeTask({ id: 've', difficulty: 'VERY_EASY' }),
      makeTask({ id: 'm', difficulty: 'MEDIUM' }),
    ];
    expect(ids(sortTasks(tasks, 'difficulty', 'asc'))).toEqual(['ve', 'm', 'vh']);
  });

  it('titulo ignora maiusculas e ordena numeros de forma natural', () => {
    const tasks = [
      makeTask({ id: '1', title: 'Frequência 10' }),
      makeTask({ id: '2', title: 'frequência 2' }),
      makeTask({ id: '3', title: 'Frequência 1' }),
    ];
    expect(ids(sortTasks(tasks, 'title', 'asc'))).toEqual(['3', '2', '1']);
  });

  it('nota real: sem nota fica no fim', () => {
    const tasks = [
      makeTask({ id: 'n', realGrade: null }),
      makeTask({ id: '14', realGrade: 14 }),
      makeTask({ id: '18', realGrade: 18 }),
    ];
    expect(ids(sortTasks(tasks, 'grade', 'desc'))).toEqual(['18', '14', 'n']);
  });

  it('e estavel nos empates e nao altera o array original', () => {
    const tasks = [
      makeTask({ id: 'x', priorityOrder: 1 }),
      makeTask({ id: 'y', priorityOrder: 1 }),
      makeTask({ id: 'z', priorityOrder: 1 }),
    ];
    const copy = [...tasks];
    expect(ids(sortTasks(tasks, 'priority', 'desc'))).toEqual(['x', 'y', 'z']);
    expect(tasks).toEqual(copy);
  });
});

describe('isSortableColumn', () => {
  it('a coluna do calendario nao e ordenavel', () => {
    expect(isSortableColumn('calendar')).toBe(false);
    expect(isSortableColumn('date')).toBe(true);
    expect(isSortableColumn('priority')).toBe(true);
  });
});
