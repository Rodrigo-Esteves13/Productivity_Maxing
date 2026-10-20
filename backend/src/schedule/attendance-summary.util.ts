export interface AttendanceGroupRow {
  subject: string;
  attended: boolean | null;
  _count: { _all: number };
}

export interface SubjectAttendance {
  subject: string;
  attended: number;
  missed: number;
  unmarked: number;
}

/**
 * Junta o groupBy [subject, attended] numa linha por disciplina, com as
 * faltas primeiro (é o que importa quando há limite de faltas) e depois
 * por nome.
 */
export function summarizeAttendance(
  rows: AttendanceGroupRow[],
): SubjectAttendance[] {
  const bySubject = new Map<string, SubjectAttendance>();
  for (const row of rows) {
    const summary = bySubject.get(row.subject) ?? {
      subject: row.subject,
      attended: 0,
      missed: 0,
      unmarked: 0,
    };
    if (row.attended === true) summary.attended += row._count._all;
    else if (row.attended === false) summary.missed += row._count._all;
    else summary.unmarked += row._count._all;
    bySubject.set(row.subject, summary);
  }
  return [...bySubject.values()].sort(
    (a, b) => b.missed - a.missed || a.subject.localeCompare(b.subject),
  );
}
