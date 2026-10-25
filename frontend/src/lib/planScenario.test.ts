import { describe, expect, it } from 'vitest';
import { applyPlanToComponents, applyPlanToTasks, buildPlanFill, median } from './planScenario';
import type { GradeComponent, Task } from '../types/models';

const task = (over: Partial<Task>): Task =>
  ({
    id: Math.random().toString(36),
    areaId: 'a1',
    periodId: 'p1',
    weightPercentage: 25,
    realGrade: null,
    targetGrade: null,
    ...over,
  }) as Task;

const component = (over: Partial<GradeComponent>): GradeComponent => ({
  id: 'c1',
  areaId: 'a1',
  periodId: 'p1',
  name: 'Participacao',
  weightPercentage: 10,
  aggregation: 'AVERAGE',
  bestOfCount: null,
  expectedEntries: null,
  grade: null,
  entries: [],
  ...over,
});

describe('planScenario', () => {
  it('median', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it('task por fazer fica com o alvo, sem alvo com a mediana da cadeira; nunca mexe em notas reais', () => {
    const tasks = [
      task({ realGrade: 10 }),
      task({ realGrade: 18 }),
      task({ realGrade: 12 }),
      task({ id: 'alvo', targetGrade: 17 }),
      task({ id: 'sem', targetGrade: null }),
      task({ id: 'sem-peso', weightPercentage: null, targetGrade: 20 }),
    ];
    const planned = applyPlanToTasks(tasks, buildPlanFill(tasks, []));
    const byId = new Map(planned.map((t) => [t.id, t.realGrade]));
    expect(byId.get('alvo')).toBe(17);
    expect(byId.get('sem')).toBe(12);
    expect(byId.get('sem-peso')).toBeNull();
    expect(planned.slice(0, 3).map((t) => t.realGrade)).toEqual([10, 18, 12]);
  });

  it('componente: entradas em falta levam a mediana e a nota e recalculada', () => {
    const tasks = [task({ realGrade: 14 })];
    const comps = [component({ expectedEntries: 4, entries: [{ id: 'e1', grade: 10 } as never, { id: 'e2', grade: 18 } as never] })];
    const [filled] = applyPlanToComponents(comps, buildPlanFill(tasks, comps));
    // mediana([14, 10, 18]) = 14 -> media(10, 18, 14, 14)
    expect(filled.grade).toBe(14);
  });

  it('sem nota nenhuma, nada e inventado', () => {
    const comps = [component({})];
    expect(applyPlanToComponents(comps, buildPlanFill([], comps))[0]).toBe(comps[0]);
  });
});
