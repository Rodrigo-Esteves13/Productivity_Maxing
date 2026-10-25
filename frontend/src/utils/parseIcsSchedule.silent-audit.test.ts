// Regression test from the silent-bug audit (area a).
import { describe, expect, it } from 'vitest';
import { parseIcsSchedule } from './parseIcsSchedule';

function ics(...events: string[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR'].join('\r\n');
}

describe('[silent-audit a-10] .ics import keeps cancelled classes', () => {
  it('an event with STATUS:CANCELLED is not imported as a class', () => {
    const text = ics(
      [
        'BEGIN:VEVENT',
        'UID:class-1',
        'DTSTART:20261012T090000Z',
        'DTEND:20261012T110000Z',
        'SUMMARY:Curso | 3 Ano | Redes | Turma A',
        'STATUS:CANCELLED',
        'END:VEVENT',
      ].join('\r\n'),
    );
    const { rows, errors } = parseIcsSchedule(text);
    // BUG: STATUS is never read. The cancelled class shows on the grid,
    // blocks study-plan slots, counts as "not marked" attendance and is
    // pushed to Google Calendar. No parse error is reported either.
    expect(errors).toEqual([]);
    expect(rows).toEqual([]);
  });
});
