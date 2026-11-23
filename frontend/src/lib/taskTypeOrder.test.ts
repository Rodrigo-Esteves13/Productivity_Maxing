import { describe, expect, it } from 'vitest';
import { canMove, moveUpdates } from './taskTypeOrder';

const items = [
  { id: 'a', order: 0 },
  { id: 'b', order: 1 },
  { id: 'c', order: 2 },
];

describe('taskTypeOrder', () => {
  it('troca dois vizinhos', () => {
    expect(moveUpdates(items, 'b', 'up')).toEqual([
      { id: 'b', order: 0 },
      { id: 'a', order: 1 },
    ]);
  });

  it('nao move alem das pontas', () => {
    expect(canMove(items, 'a', 'up')).toBe(false);
    expect(canMove(items, 'c', 'down')).toBe(false);
    expect(moveUpdates(items, 'a', 'up')).toEqual([]);
  });

  it('empates passam a posicoes distintas', () => {
    const tied = [
      { id: 'a', order: 0 },
      { id: 'b', order: 0 },
      { id: 'c', order: 0 },
    ];
    const updates = moveUpdates(tied, 'c', 'up');
    expect(updates).toContainEqual({ id: 'c', order: 1 });
    expect(updates).toContainEqual({ id: 'b', order: 2 });
  });

  it('id desconhecido nao faz nada', () => {
    expect(moveUpdates(items, 'x', 'down')).toEqual([]);
  });
});
