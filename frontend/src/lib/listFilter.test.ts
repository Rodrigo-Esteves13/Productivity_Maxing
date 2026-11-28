import { describe, expect, it } from 'vitest';
import { filterByQuery, matchesQuery, splitQuery } from './listFilter';

describe('listFilter', () => {
  it('splitQuery dobra acentos e separa palavras', () => {
    expect(splitQuery('  Revisão   SO ')).toEqual(['revisao', 'so']);
    expect(splitQuery('   ')).toEqual([]);
  });

  it('matchesQuery exige todas as palavras, em qualquer campo', () => {
    expect(matchesQuery('rev sis', ['Revisão', 'Sistemas Operativos'])).toBe(true);
    expect(matchesQuery('rev xx', ['Revisão', 'Sistemas Operativos'])).toBe(false);
  });

  it('matchesQuery ignora campos vazios e aceita pesquisa vazia', () => {
    expect(matchesQuery('', [null, undefined])).toBe(true);
    expect(matchesQuery('a', [null, undefined])).toBe(false);
  });

  it('filterByQuery devolve copia quando a pesquisa e vazia', () => {
    const items = [{ t: 'a' }, { t: 'b' }];
    const out = filterByQuery(items, '', (i) => [i.t]);
    expect(out).toEqual(items);
    expect(out).not.toBe(items);
  });

  it('filterByQuery filtra por texto', () => {
    const items = [{ t: 'Cálculo' }, { t: 'Física' }];
    expect(filterByQuery(items, 'calc', (i) => [i.t])).toEqual([{ t: 'Cálculo' }]);
  });
});
