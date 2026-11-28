import { describe, expect, it } from 'vitest';
import { addToBlockList, hasListSeparator } from './blockListParse';

const lower = (value: string) => (value.includes(' ') ? null : value.toLowerCase());

describe('addToBlockList', () => {
  it('adds a single value', () => {
    expect(addToBlockList(['a'], 'b').next).toEqual(['a', 'b']);
  });

  it('splits on commas and new lines', () => {
    const result = addToBlockList([], 'a.exe, b.exe\nc.exe\r\nd.exe');
    expect(result.added).toEqual(['a.exe', 'b.exe', 'c.exe', 'd.exe']);
    expect(result.rejected).toEqual([]);
  });

  it('flags duplicates, including repeats inside the pasted text', () => {
    const result = addToBlockList(['a'], 'a, b, b');
    expect(result.next).toEqual(['a', 'b']);
    expect(result.rejected).toEqual([
      { value: 'a', reason: 'duplicate' },
      { value: 'b', reason: 'duplicate' },
    ]);
  });

  it('flags invalid values from normalize', () => {
    const result = addToBlockList([], 'OK.com, bad value', lower);
    expect(result.next).toEqual(['ok.com']);
    expect(result.rejected).toEqual([{ value: 'bad value', reason: 'invalid' }]);
  });

  it('ignores empty parts', () => {
    expect(addToBlockList([], ' , ,\n').next).toEqual([]);
  });
});

describe('hasListSeparator', () => {
  it('detects commas and new lines only inside the text', () => {
    expect(hasListSeparator('a,b')).toBe(true);
    expect(hasListSeparator('a\nb')).toBe(true);
    expect(hasListSeparator('  a  ')).toBe(false);
    expect(hasListSeparator('a\n')).toBe(false);
  });
});
