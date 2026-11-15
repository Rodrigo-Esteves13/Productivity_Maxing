import { describe, expect, it } from 'vitest';
import { linkAt } from './ctrlClickLink';

describe('linkAt', () => {
  it('finds the link under the caret and trims sentence punctuation', () => {
    const text = 'See (https://pmaxing.pt/a?b=1). Thanks';
    expect(linkAt(text, 10)).toBe('https://pmaxing.pt/a?b=1');
    expect(linkAt(text, 35)).toBeNull();
  });

  it('accepts www links and rejects unsafe or local schemes', () => {
    expect(linkAt('go www.example.org now', 5)).toBe('https://www.example.org/');
    expect(linkAt('javascript:alert(1)', 3)).toBeNull();
    expect(linkAt('file:///C:/x.txt', 3)).toBeNull();
    expect(linkAt('http://localhost', 3)).toBeNull();
    expect(linkAt('', 0)).toBeNull();
  });
});
