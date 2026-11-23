import { describe, expect, it } from 'vitest';
import { ALL_AREAS, filterPackTasks } from './packTaskFilter';

const tasks = [
  { title: 'Relatorio de Redes', areaId: 'a1' },
  { title: 'Teste de Calculo', areaId: 'a2' },
  { title: 'Quiz', areaId: 'a1' },
];
const names: Record<string, string> = { a1: 'Redes', a2: 'Calculo' };
const nameOf = (t: { areaId: string }) => names[t.areaId];

describe('filterPackTasks', () => {
  it('sem filtros devolve tudo', () => {
    expect(filterPackTasks(tasks, '', ALL_AREAS, nameOf)).toHaveLength(3);
  });

  it('filtra por Area', () => {
    expect(filterPackTasks(tasks, '', 'a1', nameOf)).toHaveLength(2);
  });

  it('pesquisa por titulo ou nome da Area, sem acentos', () => {
    expect(filterPackTasks(tasks, 'calculo', ALL_AREAS, nameOf)).toHaveLength(1);
    expect(filterPackTasks(tasks, 'redes', ALL_AREAS, nameOf)).toHaveLength(2);
  });

  it('combina pesquisa e Area', () => {
    expect(filterPackTasks(tasks, 'quiz', 'a1', nameOf)).toHaveLength(1);
    expect(filterPackTasks(tasks, 'quiz', 'a2', nameOf)).toHaveLength(0);
  });
});
