import {
  componentsToGradedItems,
  computeComponentGrade,
} from './grade-component.util';

describe('computeComponentGrade', () => {
  it('sem entradas devolve null', () => {
    expect(computeComponentGrade([], 'AVERAGE')).toBeNull();
  });

  it('AVERAGE faz a media de todas', () => {
    expect(computeComponentGrade([10, 14, 18], 'AVERAGE')).toBe(14);
  });

  it('BEST_OF conta so as N melhores', () => {
    expect(computeComponentGrade([8, 12, 16, 18], 'BEST_OF', 2)).toBe(17);
  });

  it('BEST_OF com N maior que as entradas usa todas', () => {
    expect(computeComponentGrade([10, 20], 'BEST_OF', 5)).toBe(15);
  });

  it('BEST_OF sem N usa todas', () => {
    expect(computeComponentGrade([10, 20], 'BEST_OF', null)).toBe(15);
  });

  it('DROP_LOWEST ignora a pior', () => {
    expect(computeComponentGrade([4, 14, 16], 'DROP_LOWEST')).toBe(15);
  });

  it('DROP_LOWEST com uma so entrada mantem-na', () => {
    expect(computeComponentGrade([12], 'DROP_LOWEST')).toBe(12);
  });

  it('ignora valores nao finitos', () => {
    expect(computeComponentGrade([10, Number.NaN, 20], 'AVERAGE')).toBe(15);
  });
});

describe('componentsToGradedItems', () => {
  it('converte e salta componentes sem notas', () => {
    const items = componentsToGradedItems([
      {
        areaId: 'a1',
        periodId: 'p1',
        weightPercentage: 15,
        aggregation: 'AVERAGE',
        bestOfCount: null,
        entries: [{ grade: 12 }, { grade: 16 }],
      },
      {
        areaId: 'a1',
        periodId: 'p1',
        weightPercentage: 10,
        aggregation: 'AVERAGE',
        bestOfCount: null,
        entries: [],
      },
    ]);
    expect(items).toEqual([
      { areaId: 'a1', periodId: 'p1', realGrade: 14, weightPercentage: 15 },
    ]);
  });
});
