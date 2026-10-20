import { summarizeAttendance } from './attendance-summary.util';

const row = (subject: string, attended: boolean | null, count: number) => ({
  subject,
  attended,
  _count: { _all: count },
});

describe('summarizeAttendance', () => {
  it('junta presenças, faltas e por marcar numa linha por disciplina', () => {
    expect(
      summarizeAttendance([
        row('PC', true, 5),
        row('PC', false, 2),
        row('PC', null, 1),
      ]),
    ).toEqual([{ subject: 'PC', attended: 5, missed: 2, unmarked: 1 }]);
  });

  it('põe primeiro as disciplinas com mais faltas, depois por nome', () => {
    const result = summarizeAttendance([
      row('Bases de Dados', true, 3),
      row('Algoritmos', true, 4),
      row('Redes', false, 3),
    ]);
    expect(result.map((r) => r.subject)).toEqual([
      'Redes',
      'Algoritmos',
      'Bases de Dados',
    ]);
  });
});
