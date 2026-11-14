import {
  CHANGE_VALUE_MAX,
  diffTaskFields,
  stringifyChangeValue,
} from './task-change-diff';

describe('diffTaskFields', () => {
  it('returns one row per changed tracked field', () => {
    const rows = diffTaskFields(
      { title: 'A', progressStatus: 'NOT_STARTED', realGrade: null },
      { title: 'B', progressStatus: 'COMPLETED', realGrade: 15 },
    );
    expect(rows).toEqual([
      { field: 'title', fromValue: 'A', toValue: 'B' },
      {
        field: 'progressStatus',
        fromValue: 'NOT_STARTED',
        toValue: 'COMPLETED',
      },
      { field: 'realGrade', fromValue: null, toValue: '15' },
    ]);
  });

  it('ignores unchanged values and equal dates', () => {
    const d = new Date('2026-11-13T00:00:00.000Z');
    expect(
      diffTaskFields(
        { date: d, isPinned: false },
        { date: new Date(d), isPinned: false },
      ),
    ).toEqual([]);
  });

  it('records a date change as ISO strings', () => {
    const rows = diffTaskFields(
      { date: new Date('2026-11-13T00:00:00.000Z') },
      { date: new Date('2026-11-20T00:00:00.000Z') },
    );
    expect(rows[0]).toEqual({
      field: 'date',
      fromValue: '2026-11-13T00:00:00.000Z',
      toValue: '2026-11-20T00:00:00.000Z',
    });
  });

  it('treats booleans and cleared values', () => {
    expect(
      diffTaskFields(
        { isBlocked: false, targetGrade: 16 },
        { isBlocked: true, targetGrade: null },
      ),
    ).toEqual([
      { field: 'targetGrade', fromValue: '16', toValue: null },
      { field: 'isBlocked', fromValue: 'false', toValue: 'true' },
    ]);
  });
});

describe('stringifyChangeValue', () => {
  it('caps long text', () => {
    expect(stringifyChangeValue('x'.repeat(500))).toHaveLength(
      CHANGE_VALUE_MAX,
    );
  });
});
