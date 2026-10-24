import { describe, expect, it } from 'vitest';
import { parseStoredTemplates, pickTemplateFields, templateFieldsFor, type TaskTemplate } from './taskTemplates';

describe('taskTemplates', () => {
  it('drops invalid entries and unknown fields from storage', () => {
    const stored = JSON.stringify([
      { id: 'a', name: '  Exam  ', fields: { title: 'Exam', date: '2026-01-01', hacked: 'x', weightPercentage: 40 }, checklist: 'Review', recurrence: { frequency: 'WEEKLY', interval: '2' } },
      { id: 'b', name: '' },
      { name: 'no id' },
      'junk',
    ]);
    const [only, ...rest] = parseStoredTemplates(stored);
    expect(rest).toEqual([]);
    expect(only).toEqual({
      id: 'a',
      name: 'Exam',
      fields: { title: 'Exam' },
      checklist: 'Review',
      recurrence: { frequency: 'WEEKLY', interval: '2' },
    });
  });

  it('survives broken JSON and unknown recurrence values', () => {
    expect(parseStoredTemplates('{oops')).toEqual([]);
    const [t] = parseStoredTemplates(JSON.stringify([{ id: 'a', name: 'X', recurrence: { frequency: 'HOURLY' } }]));
    expect(t.recurrence).toEqual({ frequency: '', interval: '1' });
  });

  it('keeps only filled template fields from the form', () => {
    expect(pickTemplateFields({ title: 'Lab', date: '2026-10-24', notes: '', isPinned: true, areaId: 'x' })).toEqual({
      title: 'Lab',
      areaId: 'x',
    });
  });

  it('does not apply an area that no longer exists', () => {
    const template = { fields: { title: 'Lab', areaId: 'gone' } } as TaskTemplate;
    expect(templateFieldsFor(template, new Set(['x']))).toEqual({ title: 'Lab' });
    expect(templateFieldsFor(template, new Set(['gone']))).toEqual({ title: 'Lab', areaId: 'gone' });
  });
});
