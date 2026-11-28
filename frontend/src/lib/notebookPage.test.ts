import { describe, expect, it } from 'vitest';
import { adjacentEntries, buildFallbackTitle, fallbackArea, nextClassNumber, shareBadges } from './notebookPage';
import type { Area } from '../types/models';

describe('buildFallbackTitle', () => {
  it('comeca por maiuscula e inclui o dia', () => {
    const title = buildFallbackTitle('pt-PT', new Date(2026, 2, 5, 12));
    expect(title.charAt(0)).toBe(title.charAt(0).toUpperCase());
    expect(title).toContain('05/03');
  });
});

describe('nextClassNumber', () => {
  it('comeca em 1 sem aulas numeradas', () => {
    expect(nextClassNumber([{ entryType: 'NOTE', classNumber: 7 }, { entryType: 'CLASS', classNumber: null }])).toBe(1);
  });
  it('soma 1 ao maior numero usado em aulas', () => {
    expect(nextClassNumber([{ entryType: 'CLASS', classNumber: 4 }, { entryType: 'CLASS', classNumber: 2 }])).toBe(5);
  });
});

describe('fallbackArea', () => {
  const area = (id: string, usedInPeriod?: boolean) => ({ id, usedInPeriod }) as Area;
  it('prefere uma cadeira do periodo', () => {
    expect(fallbackArea([area('a'), area('b', true)])?.id).toBe('b');
  });
  it('cai na primeira, ou null sem cadeiras', () => {
    expect(fallbackArea([area('a'), area('b')])?.id).toBe('a');
    expect(fallbackArea([])).toBeNull();
  });
});

describe('adjacentEntries', () => {
  const list = [{ id: 'new' }, { id: 'mid' }, { id: 'old' }];
  it('devolve vizinhos pela ordem da lista', () => {
    expect(adjacentEntries(list, 'mid')).toEqual({ selectedIndex: 1, olderEntry: { id: 'old' }, newerEntry: { id: 'new' } });
  });
  it('sem vizinhos nas pontas nem sem selecao', () => {
    expect(adjacentEntries(list, 'new').newerEntry).toBeNull();
    expect(adjacentEntries(list, 'old').olderEntry).toBeNull();
    expect(adjacentEntries(list, null)).toEqual({ selectedIndex: -1, olderEntry: null, newerEntry: null });
    expect(adjacentEntries(list, 'x').olderEntry).toBeNull();
  });
});

describe('shareBadges', () => {
  it('soma pedidos e propostas por nota', () => {
    const map = shareBadges([{ entryId: 'e', pendingRequests: 2, pendingProposals: 1 }]);
    expect(map.get('e')).toEqual({ waiting: 3 });
  });
});
