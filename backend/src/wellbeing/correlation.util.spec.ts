import { pearson } from './correlation.util';

describe('pearson', () => {
  it('needs a minimum number of days', () => {
    expect(
      pearson([
        [1, 1],
        [2, 2],
      ]),
    ).toEqual({
      kind: 'not_enough_data',
      sampleSize: 2,
    });
  });

  it('reports no variation when one side is constant', () => {
    const pairs: [number, number][] = Array.from({ length: 8 }, (_, i) => [
      3,
      i,
    ]);
    expect(pearson(pairs).kind).toBe('no_variation');
  });

  it('finds a strong positive link', () => {
    const pairs: [number, number][] = Array.from({ length: 10 }, (_, i) => [
      i,
      i * 2 + (i % 2),
    ]);
    const result = pearson(pairs);
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.r).toBeGreaterThan(0.9);
      expect(result.strength).toBe('strong');
    }
  });

  it('finds a negative link', () => {
    const pairs: [number, number][] = Array.from({ length: 10 }, (_, i) => [
      i,
      10 - i,
    ]);
    const result = pearson(pairs);
    expect(result.kind === 'ok' && result.r).toBe(-1);
  });
});
