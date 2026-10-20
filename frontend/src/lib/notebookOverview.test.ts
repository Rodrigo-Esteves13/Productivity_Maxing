import { describe, expect, it } from 'vitest';
import type { NotebookEntry } from '../types/models';
import { countByType, entryPreview, missingClassNumbers, relativeDay, toEntrySummary } from './notebookOverview';

describe('entryPreview', () => {
  it('drops Markdown marks and joins lines', () => {
    expect(entryPreview('# Memória\n- **TLB** guarda `páginas`\n| a | b |')).toBe('Memória TLB guarda páginas a b');
  });

  it('cuts long text with an ellipsis', () => {
    expect(entryPreview('abcdefghij', 6)).toBe('abcde…');
  });

  it('is empty without text', () => {
    expect(entryPreview(null)).toBe('');
    expect(entryPreview('   ')).toBe('');
  });
});

describe('missingClassNumbers', () => {
  const cls = (classNumber: number | null) => ({ entryType: 'CLASS' as const, classNumber });

  it('lists the gaps up to the highest class', () => {
    expect(missingClassNumbers([cls(1), cls(2), cls(5), cls(4)])).toEqual([3]);
  });

  it('ignores notes and entries without a number', () => {
    expect(missingClassNumbers([{ entryType: 'NOTE', classNumber: 9 }, cls(null), cls(2)])).toEqual([1]);
  });

  it('gives up on numbers that are not a class sequence', () => {
    expect(missingClassNumbers([cls(2026)])).toEqual([]);
  });
});

describe('countByType', () => {
  it('counts each type', () => {
    expect(countByType([{ entryType: 'CLASS' }, { entryType: 'CLASS' }, { entryType: 'NOTE' }])).toEqual({
      CLASS: 2,
      NOTE: 1,
      STUDY: 0,
    });
  });
});

describe('relativeDay', () => {
  it('counts calendar days', () => {
    const now = new Date(2026, 9, 19, 9, 0);
    expect(relativeDay(new Date(2026, 9, 19, 23, 0).toISOString(), 'en', now)).toBe('today');
    expect(relativeDay(new Date(2026, 9, 18, 23, 0).toISOString(), 'en', now)).toBe('yesterday');
    expect(relativeDay(new Date(2026, 9, 14).toISOString(), 'en', now)).toBe('5 days ago');
  });
});

describe('toEntrySummary', () => {
  it('keeps the list fields, a 400-char preview and the file counts', () => {
    const entry = {
      id: 'e1',
      userId: 'u1',
      areaId: 'a1',
      classOccurrenceId: null,
      title: 'Aula 4',
      entryType: 'CLASS',
      classNumber: 4,
      textContent: 'y'.repeat(900),
      drawingStrokes: [],
      tables: null,
      canvasShapes: null,
      canvasLinks: null,
      canvasTexts: null,
      usefulLinks: null,
      canvasHeight: null,
      date: '2026-10-19T10:00:00.000Z',
      photos: [{ id: 'p1' }, { id: 'p2' }],
      attachments: [{ id: 'f1' }],
    } as unknown as NotebookEntry;

    const summary = toEntrySummary(entry);

    expect(summary).toEqual({
      id: 'e1',
      areaId: 'a1',
      title: 'Aula 4',
      entryType: 'CLASS',
      classNumber: 4,
      date: '2026-10-19T10:00:00.000Z',
      preview: 'y'.repeat(400),
      photoCount: 2,
      attachmentCount: 1,
    });
    expect(toEntrySummary({ ...entry, textContent: null }).preview).toBeNull();
  });
});
