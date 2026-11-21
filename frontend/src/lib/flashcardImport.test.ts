import { describe, expect, it } from 'vitest';
import { FLASHCARD_USER_MAX, IMPORT_FRONT_MAX, chunkCards, parseFlashcardText, withReverseCards } from './flashcardImport';

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

describe('withReverseCards', () => {
  it('appends swapped cards after the originals', () => {
    const r = withReverseCards([{ front: 'cat', back: 'gato' }]);
    expect(r.cards).toEqual([
      { front: 'cat', back: 'gato' },
      { front: 'gato', back: 'cat' },
    ]);
    expect(r.reverseCount).toBe(1);
  });

  it('skips reverses whose back is too long for a front', () => {
    const r = withReverseCards([{ front: 'a', back: 'x'.repeat(IMPORT_FRONT_MAX + 1) }]);
    expect(r.cards).toHaveLength(1);
    expect(r.skippedTooLong).toBe(1);
  });

  it('does not duplicate existing fronts or fronts in the batch', () => {
    const r = withReverseCards(
      [
        { front: 'cat', back: 'gato' },
        { front: 'gato', back: 'cat' },
        { front: 'dog', back: 'Cao' },
        { front: 'other', back: 'cao' },
      ],
      ['GATO'],
    );
    // gato (existing) and cat (in batch) are skipped; first cao accepted, second is a dup.
    expect(r.cards.map((c) => c.front)).toEqual(['cat', 'gato', 'dog', 'other', 'Cao']);
    expect(r.skippedDuplicate).toBe(3);
    expect(r.reverseCount).toBe(1);
  });

  it('respects the per-user cap', () => {
    const r = withReverseCards([{ front: 'a', back: 'b' }], [], FLASHCARD_USER_MAX - 1);
    expect(r.cards).toHaveLength(1);
    expect(r.skippedOverCap).toBe(1);
  });
});
