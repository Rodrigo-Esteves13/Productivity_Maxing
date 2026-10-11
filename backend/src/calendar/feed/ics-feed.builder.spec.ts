import {
  buildIcsFeed,
  escapeIcsText,
  foldIcsLine,
  lisbonWallClockToUtc,
} from './ics-feed.builder';

describe('ics-feed.builder', () => {
  it('escapa vírgulas, ponto e vírgula, barras e quebras de linha', () => {
    expect(escapeIcsText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
  });

  it('dobra linhas a 75 octetos contando bytes UTF-8', () => {
    const folded = foldIcsLine(`SUMMARY:${'ção'.repeat(40)}`);
    for (const physical of folded.split('\r\n')) {
      expect(Buffer.byteLength(physical, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ção'.repeat(40)}`);
  });

  it('converte hora de Lisboa para UTC (verão +1h, inverno +0h)', () => {
    // 15 jul: Lisboa = UTC+1 -> 09:00 local = 08:00Z
    expect(lisbonWallClockToUtc('2026-07-15', 9 * 60).toISOString()).toBe(
      '2026-07-15T08:00:00.000Z',
    );
    // 15 jan: Lisboa = UTC+0
    expect(lisbonWallClockToUtc('2026-01-15', 9 * 60).toISOString()).toBe(
      '2026-01-15T09:00:00.000Z',
    );
  });

  it('gera VCALENDAR válido com evento com hora e de dia inteiro', () => {
    const ics = buildIcsFeed(
      [
        {
          uid: 'class:1@pmaxing',
          title: 'Redes, Aula 3',
          start: new Date('2026-07-15T08:00:00Z'),
          end: new Date('2026-07-15T09:00:00Z'),
        },
        { uid: 'task:2@pmaxing', title: 'Exame SO', allDayDate: '2026-12-12' },
      ],
      {
        calendarName: 'Productivity Maxing',
        now: new Date('2026-10-10T10:00:00Z'),
      },
    );
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics).toContain('DTSTART:20260715T080000Z');
    expect(ics).toContain('SUMMARY:Redes\\, Aula 3');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261212');
    expect(ics).toContain('DTEND;VALUE=DATE:20261213');
  });
});
