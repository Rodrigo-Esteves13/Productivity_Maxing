import { describe, expect, it } from 'vitest';
import { LEECH_LAPSES, LEECH_LONG_BACK, LEECH_LONG_FRONT, isLeech, leechAdviceKey } from './flashcardLeech';

describe('isLeech', () => {
  it('flags cards at or above the lapse threshold', () => {
    expect(isLeech({ lapses: LEECH_LAPSES - 1 })).toBe(false);
    expect(isLeech({ lapses: LEECH_LAPSES })).toBe(true);
    expect(isLeech({ lapses: LEECH_LAPSES + 5 })).toBe(true);
  });
});

describe('leechAdviceKey', () => {
  it('suggests split for long or multi-line backs', () => {
    expect(leechAdviceKey({ front: 'a', back: 'x'.repeat(LEECH_LONG_BACK + 1) })).toBe('split');
    expect(leechAdviceKey({ front: 'a', back: 'one\ntwo' })).toBe('split');
  });
  it('suggests cloze for long fronts', () => {
    expect(leechAdviceKey({ front: 'x'.repeat(LEECH_LONG_FRONT + 1), back: 'b' })).toBe('cloze');
  });
  it('defaults to rewrite', () => {
    expect(leechAdviceKey({ front: 'a', back: 'b' })).toBe('rewrite');
  });
});
