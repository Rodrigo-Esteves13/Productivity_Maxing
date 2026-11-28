import { describe, expect, it } from 'vitest';
import { selectionState, splitAreaSections } from './areaSections';
import type { Area } from '../types/models';

const area = (id: string, isOfficial: boolean) => ({ id, isOfficial }) as Area;

describe('splitAreaSections', () => {
  it('separa as visiveis e conta os totais antes do filtro', () => {
    const all = [area('o1', true), area('o2', true), area('p1', false)];
    const result = splitAreaSections(all, [all[0], all[2]]);
    expect(result.official.map((a) => a.id)).toEqual(['o1']);
    expect(result.personal.map((a) => a.id)).toEqual(['p1']);
    expect(result.officialTotal).toBe(2);
    expect(result.personalTotal).toBe(1);
  });
});

describe('selectionState', () => {
  it('distingue nenhuma, algumas e todas', () => {
    expect(selectionState(['a', 'b'], new Set())).toEqual({ allSelected: false, anySelected: false });
    expect(selectionState(['a', 'b'], new Set(['a']))).toEqual({ allSelected: false, anySelected: true });
    expect(selectionState(['a', 'b'], new Set(['a', 'b']))).toEqual({ allSelected: true, anySelected: true });
  });
  it('lista vazia: todas (nada por marcar) e nenhuma', () => {
    expect(selectionState([], new Set(['a']))).toEqual({ allSelected: true, anySelected: false });
  });
});
