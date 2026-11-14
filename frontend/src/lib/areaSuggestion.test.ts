import { describe, expect, it } from 'vitest';
import { suggestAreaId } from './areaSuggestion';

const areas = [
  { id: 'bd', name: 'Bases de Dados' },
  { id: 'aed', name: 'Algoritmos e Estruturas de Dados' },
];
const tasks = [
  { title: 'Frequência 1', areaId: 'bd' },
  { title: 'Frequência 2', areaId: 'bd' },
  { title: 'Projeto final', areaId: 'aed' },
];

describe('suggestAreaId', () => {
  it('matches a course name inside the title, ignoring accents and case', () => {
    expect(suggestAreaId('estudar bases de dados', areas, [])).toBe('bd');
  });
  it('uses the leading word of earlier tasks when they agree', () => {
    expect(suggestAreaId('Frequencia 3', areas, tasks)).toBe('bd');
  });
  it('does not guess with too few matches or mixed courses', () => {
    expect(suggestAreaId('Projeto novo', areas, tasks)).toBeNull();
    expect(
      suggestAreaId('Frequência 4', areas, [...tasks, { title: 'Frequência 9', areaId: 'aed' }]),
    ).toBeNull();
  });
  it('ignores short titles and unknown areas', () => {
    expect(suggestAreaId('ab', areas, tasks)).toBeNull();
    expect(suggestAreaId('Frequência 3', [], tasks)).toBeNull();
  });
});
