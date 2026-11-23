import { describe, expect, it } from 'vitest';
import { addPadRecent, parsePadRecents, pasteExceedsLimit } from './padRecents';

describe('addPadRecent', () => {
  it('puts new first and dedupes', () => {
    expect(addPadRecent(['a', 'b'], 'b')).toEqual(['b', 'a']);
  });
  it('caps the list', () => {
    expect(addPadRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b']);
  });
});

describe('parsePadRecents', () => {
  it('handles junk', () => {
    expect(parsePadRecents(null)).toEqual([]);
    expect(parsePadRecents('nope')).toEqual([]);
    expect(parsePadRecents('{"a":1}')).toEqual([]);
  });
  it('keeps only valid unique slugs', () => {
    expect(parsePadRecents('["ok","Bad Name","ok",3,"two"]')).toEqual(['ok', 'two']);
  });
});

describe('pasteExceedsLimit', () => {
  it('counts the replaced selection', () => {
    expect(pasteExceedsLimit(90, 0, 11, 100)).toBe(true);
    expect(pasteExceedsLimit(90, 5, 15, 100)).toBe(false);
    expect(pasteExceedsLimit(90, 5, 16, 100)).toBe(true);
  });
});
