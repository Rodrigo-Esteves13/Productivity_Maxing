import { describe, expect, it } from 'vitest';
import { NOTEBOOK_ENTRY_CONFLICT_CODE, parseEntryConflict } from './notebookEntryConflict';

// C-01: gravar sobre uma versao antiga devolve 409 com a versao atual.
describe('parseEntryConflict', () => {
  const conflict = (data: unknown, status = 409) => ({ response: { status, data } });

  it('returns the current entry from a notebook conflict', () => {
    const current = { id: 'e1', title: 'Co-owner title', updatedAt: '2026-10-01T10:05:00.000Z' };
    expect(parseEntryConflict(conflict({ code: NOTEBOOK_ENTRY_CONFLICT_CODE, current }))).toEqual(current);
  });

  it('ignores other 409s and other errors', () => {
    expect(parseEntryConflict(conflict({ code: 'INVITE_NOTE_FULL' }))).toBeNull();
    expect(parseEntryConflict(conflict({ code: NOTEBOOK_ENTRY_CONFLICT_CODE, current: {} }, 500))).toBeNull();
    expect(parseEntryConflict(new Error('offline'))).toBeNull();
  });
});
