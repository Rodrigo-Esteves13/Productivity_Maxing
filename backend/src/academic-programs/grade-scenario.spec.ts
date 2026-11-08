import { applyPlanScenario, loadScenarioGradedItems } from './grade-scenario';
import type { PlanComponentRow, PlanTaskRow } from './grade-scenario';
import { computeWeightedAverage } from './grade-average.util';
import type { PrismaService } from '../prisma/prisma.service';

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

  describe('roundInterimGrades', () => {
    const rows = () => ({
      tasks: [
        task({ title: 'Real', realGrade: 15.5 }),
        task({ title: 'Alvo', targetGrade: 12.5 }),
      ],
      components: [
        component({ grades: [14, 15] }),
        component({ grades: [14.5], expectedEntries: 2 }),
      ],
    });

    it('arredonda so as notas reais lancadas quando ligado', () => {
      const { tasks, components } = rows();
      const items = applyPlanScenario(tasks, components, true);
      const byTitle = new Map(items.map((i) => [i.title, i.realGrade]));
      expect(byTitle.get('Real')).toBe(16);
      // Alvo escrito pelo user (hipotetico): nunca arredondado.
      expect(byTitle.get('Alvo')).toBe(12.5);
      const componentGrades = items
        .filter((i) => i.title === undefined)
        .map((i) => i.realGrade);
      // 14.5 real -> 15; o segundo leva a mediana do plano (hipotetico), fica igual.
      expect(componentGrades[0]).toBe(15);
      // Mediana da cadeira [16, 14, 15, 14.5] = 14.75; media com 14.5 = 14.63
      // (2 casas, computeComponentGrade). Sem arredondar ao inteiro.
      expect(componentGrades[1]).toBe(14.63);
    });

    it('nao mexe em nada quando desligado', () => {
      const { tasks, components } = rows();
      const items = applyPlanScenario(tasks, components, false);
      const byTitle = new Map(items.map((i) => [i.title, i.realGrade]));
      expect(byTitle.get('Real')).toBe(15.5);
      expect(byTitle.get('Alvo')).toBe(12.5);
      expect(items.filter((i) => i.title === undefined)[0].realGrade).toBe(
        14.5,
      );
    });
  });
});

describe('loadScenarioGradedItems (real)', () => {
  const prisma = () =>
    ({
      task: {
        findMany: jest.fn().mockResolvedValue([
          {
            realGrade: 15.5,
            weightPercentage: 50,
            areaId: 'a1',
            periodId: 'p1',
            title: 'T',
            recurrenceFrequency: null,
          },
        ]),
      },
      gradeComponent: {
        findMany: jest.fn().mockResolvedValue([
          {
            areaId: 'a1',
            periodId: 'p1',
            weightPercentage: 10,
            aggregation: 'AVERAGE',
            bestOfCount: null,
            entries: [{ grade: 14 }, { grade: 15 }],
          },
        ]),
      },
    }) as unknown as PrismaService;

  it('arredonda cada nota intercalar quando ligado', async () => {
    const items = await loadScenarioGradedItems(prisma(), {}, {}, 'real', true);
    expect(items.map((i) => i.realGrade)).toEqual([16, 15]);
  });

  it('devolve as notas como estao quando desligado', async () => {
    const items = await loadScenarioGradedItems(prisma(), {}, {}, 'real');
    expect(items.map((i) => i.realGrade)).toEqual([15.5, 14.5]);
  });
});
