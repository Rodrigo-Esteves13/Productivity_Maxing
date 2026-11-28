import { describe, expect, it } from 'vitest';
import { minVisibleForIndex } from './incrementalReveal';

describe('minVisibleForIndex', () => {
  it('nao obriga a nada sem linha escolhida', () => {
    expect(minVisibleForIndex(-1, 30)).toBe(0);
  });
  it('arredonda ao bloco que contem a linha', () => {
    expect(minVisibleForIndex(0, 30)).toBe(30);
    expect(minVisibleForIndex(29, 30)).toBe(30);
    expect(minVisibleForIndex(30, 30)).toBe(60);
  });
});
