import { describe, expect, it } from 'vitest';
import { chunkCards, parseFlashcardText } from './flashcardImport';

describe('parseFlashcardText', () => {
  it('reads tab, semicolon and comma separated lines', () => {
    const result = parseFlashcardText('cat\tgato\ndog;cao\nbird, passaro, ave');
    expect(result.cards).toEqual([
      { front: 'cat', back: 'gato' },
      { front: 'dog', back: 'cao' },
      { front: 'bird', back: 'passaro, ave' },
    ]);
    expect(result.skipped).toEqual([]);
  });

  it('prefers the tab even when commas come first', () => {
    expect(parseFlashcardText('a, b\tc').cards).toEqual([{ front: 'a, b', back: 'c' }]);
  });

  it('skips lines with no separator, empty sides, long text and duplicates', () => {
    const long = 'x'.repeat(301);
    const result = parseFlashcardText(`nope\n;back\nfront;\n${long};b\nok;1\nOK;2`, ['Existing']);
    expect(result.cards).toEqual([{ front: 'ok', back: '1' }]);
    expect(result.skipped).toEqual([
      { line: 1, reason: 'noSeparator' },
      { line: 2, reason: 'empty' },
      { line: 3, reason: 'empty' },
      { line: 4, reason: 'tooLong' },
      { line: 6, reason: 'duplicate' },
    ]);
  });

  it('skips cards that already exist and blank lines', () => {
    const result = parseFlashcardText('\nExisting;x\n\n', ['existing']);
    expect(result.cards).toEqual([]);
    expect(result.skipped).toEqual([{ line: 2, reason: 'duplicate' }]);
  });
});

describe('chunkCards', () => {
  it('splits into batches', () => {
    expect(chunkCards([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
