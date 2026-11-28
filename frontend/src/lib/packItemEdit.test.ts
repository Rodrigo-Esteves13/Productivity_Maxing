import { describe, expect, it } from 'vitest';
import { draftFromItem, packItemChanges } from './packItemEdit';

const item = {
  id: 'i1',
  title: 'Relatorio',
  date: '2026-11-20T14:30:00.000Z',
  weightPercentage: 20,
  areaName: 'Redes',
  sourceTaskId: 't1',
};

describe('packItemChanges', () => {
  it('sem alteracoes devolve vazio', () => {
    expect(packItemChanges(item, draftFromItem(item))).toEqual({});
  });

  it('mudar o dia mantem a hora original', () => {
    expect(packItemChanges(item, { ...draftFromItem(item), day: '2026-11-27' })).toEqual({
      date: '2026-11-27T14:30:00.000Z',
    });
  });

  it('peso vazio limpa; titulo vazio nao e enviado', () => {
    expect(packItemChanges(item, { ...draftFromItem(item), title: '  ', weight: '' })).toEqual({
      weightPercentage: null,
    });
  });
});
