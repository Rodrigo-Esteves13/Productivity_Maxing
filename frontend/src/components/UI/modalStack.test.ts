import { describe, expect, it } from 'vitest';
import { isTopLayer, pushLayer, removeLayer } from './modalStack';

describe('modalStack', () => {
  it('so a camada do topo e "top"', () => {
    const modal = Symbol('modal');
    const confirm = Symbol('confirm');
    pushLayer(modal);
    expect(isTopLayer(modal)).toBe(true);
    pushLayer(confirm);
    expect(isTopLayer(confirm)).toBe(true);
    expect(isTopLayer(modal)).toBe(false);
    removeLayer(confirm);
    expect(isTopLayer(modal)).toBe(true);
    removeLayer(modal);
    expect(isTopLayer(modal)).toBe(false);
  });

  it('remover uma camada do meio nao muda o topo', () => {
    const a = Symbol('a');
    const b = Symbol('b');
    const c = Symbol('c');
    pushLayer(a);
    pushLayer(b);
    pushLayer(c);
    removeLayer(b);
    expect(isTopLayer(c)).toBe(true);
    removeLayer(c);
    expect(isTopLayer(a)).toBe(true);
    removeLayer(a);
  });
});
