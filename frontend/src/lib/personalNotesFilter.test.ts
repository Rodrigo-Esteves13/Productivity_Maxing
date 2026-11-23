import { describe, expect, it } from 'vitest';
import type { PersonalNote } from '../types/models';
import {
  filterNotesByState,
  isNearNoteLimit,
  isNoteLimitReached,
  isPastLocalInput,
  notesToText,
} from './personalNotesFilter';

const base: PersonalNote = {
  id: 'n',
  title: 'T',
  body: '',
  pinned: false,
  remindAt: null,
  remindedAt: null,
  doneAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};
const make = (over: Partial<PersonalNote>): PersonalNote => ({ ...base, ...over });

describe('filterNotesByState', () => {
  const notes = [
    make({ id: 'a', remindAt: '2026-02-01T10:00:00Z' }),
    make({ id: 'b', remindAt: '2026-02-01T10:00:00Z', doneAt: '2026-01-02T00:00:00Z' }),
    make({ id: 'c', pinned: true }),
    make({ id: 'd', doneAt: '2026-01-02T00:00:00Z' }),
  ];
  const ids = (list: PersonalNote[]) => list.map((n) => n.id);

  it('all keeps everything', () => expect(ids(filterNotesByState(notes, 'all'))).toEqual(['a', 'b', 'c', 'd']));
  it('reminder skips done notes', () => expect(ids(filterNotesByState(notes, 'reminder'))).toEqual(['a']));
  it('done', () => expect(ids(filterNotesByState(notes, 'done'))).toEqual(['b', 'd']));
  it('pinned', () => expect(ids(filterNotesByState(notes, 'pinned'))).toEqual(['c']));
});

describe('limits', () => {
  it('near limit from 80 percent', () => {
    expect(isNearNoteLimit(399, 500)).toBe(false);
    expect(isNearNoteLimit(400, 500)).toBe(true);
  });
  it('limit reached', () => {
    expect(isNoteLimitReached(499, 500)).toBe(false);
    expect(isNoteLimitReached(500, 500)).toBe(true);
  });
});

describe('isPastLocalInput', () => {
  const now = new Date('2026-05-10T12:00').getTime();
  it('empty is not past', () => expect(isPastLocalInput('', now)).toBe(false));
  it('past', () => expect(isPastLocalInput('2026-05-10T11:59', now)).toBe(true));
  it('future', () => expect(isPastLocalInput('2026-05-10T12:01', now)).toBe(false));
});

describe('notesToText', () => {
  it('writes flags, reminder and body', () => {
    const text = notesToText(
      [make({ title: 'Um', body: 'corpo', pinned: true, remindAt: '2026-02-01T10:00:00Z' }), make({ title: 'Dois' })],
      { done: 'feita', pinned: 'fixada', reminder: (iso) => `R ${iso}` },
    );
    expect(text).toContain('Um [fixada]\nR 2026-02-01T10:00:00Z\n\ncorpo');
    expect(text).toContain('Dois');
    expect(text.split('----------')).toHaveLength(2);
  });
});
