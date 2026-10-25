import { describe, expect, it } from 'vitest';
import { selectableGrantAreaIds } from './notesAccess';

// C-07: o seletor nao pode comecar com cadeiras que ja nao mostra.
describe('selectableGrantAreaIds', () => {
  it('drops granted subjects that are no longer offered', () => {
    const view = { areas: [{ areaId: 'a1', name: 'BD', entryCount: 3 }] } as Parameters<typeof selectableGrantAreaIds>[1];
    expect(selectableGrantAreaIds(['a1', 'gone'], view)).toEqual(['a1']);
  });
});
