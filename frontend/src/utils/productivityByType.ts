import type { Task, AcademicTaskTypeOption } from '../types/models';
import { wasCompletedOnTime } from './deadlineCompliance';

export interface TypeProductivityRow {
  key: string;
  label: string;
  total: number;
  completed: number;
  completedPct: number;
  // Completed tasks that carry a real completedAt - the only ones whose
  // punctuality can be judged (see wasCompletedOnTime).
  onTimeEligible: number;
  onTimePct: number | null;
  avgGrade: number | null;
}

const OTHER_KEY = '__none__';
const round1 = (n: number) => Math.round(n * 10) / 10;

// Per academic task type (Test, Project, Assignment... whatever the admin
// catalog defines): how many exist, how many got finished, how many of
// those were on time, and the average real grade. Tasks with no
// academicType are grouped as "Other" instead of being dropped.
export function computeProductivityByType(
  tasks: Task[],
  types: AcademicTaskTypeOption[],
): TypeProductivityRow[] {
  const labelByKey = new Map(types.map((t) => [t.key, t.label]));
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = task.academicType ?? OTHER_KEY;
    const list = groups.get(key);
    if (list) list.push(task);
    else groups.set(key, [task]);
  }

  const rows: TypeProductivityRow[] = [];
  for (const [key, group] of groups) {
    const completed = group.filter((t) => t.progressStatus === 'COMPLETED').length;
    const punctuality = group.map(wasCompletedOnTime).filter((v): v is boolean => v !== null);
    const onTimeCount = punctuality.filter(Boolean).length;
    const grades = group.map((t) => t.realGrade).filter((g): g is number => g !== null);

    rows.push({
      key,
      label: key === OTHER_KEY ? 'Other' : (labelByKey.get(key) ?? key),
      total: group.length,
      completed,
      completedPct: Math.round((completed / group.length) * 100),
      onTimeEligible: punctuality.length,
      onTimePct: punctuality.length > 0 ? Math.round((onTimeCount / punctuality.length) * 100) : null,
      avgGrade: grades.length > 0 ? round1(grades.reduce((s, g) => s + g, 0) / grades.length) : null,
    });
  }
  return rows.sort((a, b) => b.total - a.total);
}
