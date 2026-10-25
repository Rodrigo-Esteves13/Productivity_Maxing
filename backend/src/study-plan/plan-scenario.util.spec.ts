import { buildCourseScenario, median } from './plan-scenario.util';
import type { ScenarioComponent, ScenarioTask } from './plan-scenario.util';

const task = (over: Partial<ScenarioTask>): ScenarioTask => ({
  areaId: 'a1',
  title: 'Teste',
  weightPercentage: 50,
  realGrade: null,
  targetGrade: null,
  projectedGrade: null,
  isRecurring: false,
  ...over,
});

const component = (over: Partial<ScenarioComponent>): ScenarioComponent => ({
  areaId: 'a1',
  name: 'Participacao',
  weightPercentage: 10,
  aggregation: 'AVERAGE',
  bestOfCount: null,
  expectedEntries: null,
  grades: [],
  ...over,
});

describe('median', () => {
  it('impar, par e vazio', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('buildCourseScenario', () => {
  it('plano usa o alvo; projecao usa o estudo; delta e a diferenca', () => {
    const result = buildCourseScenario(
      'a1',
      [
        task({ title: 'Freq 1', realGrade: 12 }),
        task({ title: 'Freq 2', targetGrade: 16, projectedGrade: 13 }),
      ],
      [],
      null,
    );
    expect(result.currentAverage).toBe(12);
    expect(result.projectedFinal).toBe(12.5);
    expect(result.planFinal).toBe(14);
    expect(result.delta).toBe(1.5);
    expect(result.missingWeight).toBe(0);
  });

  it('componente sem notas vale a mediana das notas da cadeira (nao a media)', () => {
    const result = buildCourseScenario(
      'a1',
      [
        task({ title: 'A', weightPercentage: 30, realGrade: 10 }),
        task({ title: 'B', weightPercentage: 30, realGrade: 12 }),
        task({ title: 'C', weightPercentage: 30, realGrade: 20 }),
      ],
      [component({ weightPercentage: 10 })],
      null,
    );
    expect(result.fills).toEqual([
      expect.objectContaining({
        label: 'Participacao',
        grade: 12,
        source: 'course_median',
      }),
    ]);
    // (10+12+20)*30 + 12*10 = 1380 / 100
    expect(result.planFinal).toBe(13.8);
  });

  it('entradas em falta de um componente levam a mediana', () => {
    const result = buildCourseScenario(
      'a1',
      [task({ realGrade: 14 })],
      [component({ expectedEntries: 4, grades: [10, 18] })],
      null,
    );
    // mediana da cadeira = mediana([14, 10, 18]) = 14; componente = media(10,18,14,14) = 14
    expect(result.fills[0]).toMatchObject({ grade: 14, kind: 'component' });
  });

  it('sem notas na cadeira cai na mediana do periodo; sem nada fica de fora', () => {
    const withPeriod = buildCourseScenario('a1', [], [component({})], 15);
    expect(withPeriod.fills[0]).toMatchObject({
      grade: 15,
      source: 'period_median',
    });
    expect(withPeriod.planFinal).toBe(15);

    const nothing = buildCourseScenario(
      'a1',
      [task({})],
      [component({})],
      null,
    );
    expect(nothing.planFinal).toBeNull();
    expect(nothing.missingWeight).toBe(60);
  });

  it('serie recorrente conta o peso uma vez', () => {
    const result = buildCourseScenario(
      'a1',
      [
        task({
          title: 'Quiz',
          weightPercentage: 10,
          realGrade: 10,
          isRecurring: true,
        }),
        task({
          title: 'Quiz',
          weightPercentage: 10,
          targetGrade: 14,
          isRecurring: true,
        }),
        task({ title: 'Exame', weightPercentage: 90, targetGrade: 15 }),
      ],
      [],
      null,
    );
    expect(result.plannedWeight).toBe(100);
    // quiz = media(10,14) = 12 -> (12*10 + 15*90) / 100
    expect(result.planFinal).toBe(14.7);
  });

  it('sem projecao para alguma avaliacao, a projecao atual fica null', () => {
    const result = buildCourseScenario(
      'a1',
      [task({ targetGrade: 15 })],
      [],
      null,
    );
    expect(result.projectedFinal).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.planFinal).toBe(15);
  });
});
