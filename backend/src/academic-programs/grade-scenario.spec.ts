import { applyPlanScenario } from './grade-scenario';
import type { PlanComponentRow, PlanTaskRow } from './grade-scenario';
import { computeWeightedAverage } from './grade-average.util';

const task = (over: Partial<PlanTaskRow>): PlanTaskRow => ({
  areaId: 'a1',
  periodId: 'p1',
  title: 'T',
  recurrenceFrequency: null,
  realGrade: null,
  weightPercentage: 50,
  targetGrade: null,
  isArchivedPeriod: false,
  ...over,
});

const component = (over: Partial<PlanComponentRow>): PlanComponentRow => ({
  areaId: 'a1',
  periodId: 'p1',
  weightPercentage: 10,
  aggregation: 'AVERAGE',
  bestOfCount: null,
  expectedEntries: null,
  grades: [],
  isArchivedPeriod: false,
  ...over,
});

describe('applyPlanScenario', () => {
  it('avaliacao por fazer usa o alvo; sem alvo, a mediana da cadeira', () => {
    const items = applyPlanScenario(
      [
        task({ title: 'A', realGrade: 10, weightPercentage: 25 }),
        task({ title: 'B', realGrade: 14, weightPercentage: 25 }),
        task({ title: 'C', realGrade: 18, weightPercentage: 25 }),
        task({ title: 'D', targetGrade: 16, weightPercentage: 15 }),
        task({ title: 'E', weightPercentage: 10 }),
      ],
      [],
    );
    const byTitle = new Map(items.map((i) => [i.title, i.realGrade]));
    expect(byTitle.get('D')).toBe(16);
    expect(byTitle.get('E')).toBe(14);
  });

  it('componente sem notas leva a mediana; periodo arquivado nunca e preenchido', () => {
    const items = applyPlanScenario(
      [
        task({ realGrade: 12 }),
        task({
          title: 'Velha',
          periodId: 'p0',
          targetGrade: 20,
          isArchivedPeriod: true,
        }),
      ],
      [component({}), component({ periodId: 'p0', isArchivedPeriod: true })],
    );
    expect(items.find((i) => i.title === 'Velha')).toBeUndefined();
    expect(items.filter((i) => i.title === undefined)).toEqual([
      expect.objectContaining({ periodId: 'p1', realGrade: 12 }),
    ]);
  });

  it('sem nota nenhuma em lado nenhum, o que nao tem alvo fica de fora', () => {
    const items = applyPlanScenario([task({})], [component({})]);
    expect(items).toEqual([]);
  });

  it('tasks sem peso e sem nota nao entram (como no cenario real)', () => {
    const items = applyPlanScenario(
      [
        task({ realGrade: 10 }),
        task({ title: 'Sem peso', weightPercentage: null, targetGrade: 20 }),
      ],
      [],
    );
    expect(computeWeightedAverage(items).average).toBe(10);
  });
});
