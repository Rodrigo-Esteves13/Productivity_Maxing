import type { RiskComponentInput } from '../approval-rules/approval-rules.types';
import { computeComponentGrade } from '../grade-components/grade-component.util';
import type { GradeAggregationKind } from '../grade-components/grade-components.constants';
import { resolveStudyMinutes } from '../common/session-minutes.util';
import { absenceShare, MIN_HELD_CLASSES } from '../schedule/absence-limit.util';
import type { SubjectAttendance } from '../schedule/attendance-summary.util';

// Funcoes puras (sem BD) que transformam linhas da BD no CourseRiskInput.

export interface RiskTaskRow {
  title: string;
  date: Date;
  completedAt: Date | null;
  weightPercentage: number | null;
  realGrade: number | null;
  recurrenceFrequency: string | null;
  estimatedMinutes: number | null;
  recalledStudyMinutes: number | null;
  postponedCount: number;
  studySessions: { startedAt: Date; endedAt: Date | null }[];
}

export interface RiskComponentRow {
  name: string;
  weightPercentage: number;
  aggregation: GradeAggregationKind;
  bestOfCount: number | null;
  entries: { grade: number }[];
}

/**
 * Tasks com peso ou nota + componentes de nota -> componentes do motor.
 * Uma serie recorrente (mesmo titulo) vale o peso UMA vez, com a media das
 * ocorrencias avaliadas e o maior peso: a mesma regra de
 * grade-average.util.ts (collapseRecurringSeries) e do weight-budget.ts.
 * Task sem peso nao e componente (nao conta nada para o risco, ao contrario
 * das medias simples): senao virava um componente de 1% que disparava as
 * regras duras (nota minima por componente) com muito pouca informacao.
 */
export function buildRiskComponents(
  tasks: RiskTaskRow[],
  components: RiskComponentRow[],
): RiskComponentInput[] {
  const result: RiskComponentInput[] = [];
  const series = new Map<
    string,
    { gradeSum: number; graded: number; weight: number | null }
  >();

  for (const task of tasks) {
    if (task.weightPercentage == null) continue;
    if (!task.recurrenceFrequency) {
      result.push({
        label: task.title,
        weightPct: task.weightPercentage,
        grade: task.realGrade,
      });
      continue;
    }
    const entry = series.get(task.title) ?? {
      gradeSum: 0,
      graded: 0,
      weight: null,
    };
    if (task.realGrade != null) {
      entry.gradeSum += task.realGrade;
      entry.graded += 1;
    }
    entry.weight = Math.max(entry.weight ?? 0, task.weightPercentage);
    series.set(task.title, entry);
  }

  for (const [title, entry] of series) {
    if (entry.weight === null) continue;
    result.push({
      label: title,
      weightPct: entry.weight,
      grade: entry.graded > 0 ? entry.gradeSum / entry.graded : null,
    });
  }

  for (const component of components) {
    result.push({
      label: component.name,
      weightPct: component.weightPercentage,
      grade: computeComponentGrade(
        component.entries.map((e) => e.grade),
        component.aggregation,
        component.bestOfCount,
      ),
    });
  }
  return result;
}

/**
 * Minutos estudados vs estimados, so sobre tasks "ja vencidas": a data ja
 * passou, ou estao concluidas, ou ja tem nota. As futuras ficam de fora
 * (nos dois lados), senao o inicio do semestre parecia sempre pouco estudo.
 * So conta tasks com estimativa; sem nenhuma, os dois ficam null (o motor
 * ignora o sinal). Os valores sao minutos inteiros.
 */
export function isTaskDue(task: RiskTaskRow, now: Date): boolean {
  return (
    task.date.getTime() <= now.getTime() ||
    task.completedAt != null ||
    task.realGrade != null
  );
}

export function sumStudyVsEstimate(
  tasks: RiskTaskRow[],
  now: Date,
): {
  studiedMinutes: number | null;
  estimatedMinutes: number | null;
} {
  let studied = 0;
  let estimated = 0;
  for (const task of tasks) {
    if (!task.estimatedMinutes || task.estimatedMinutes <= 0) continue;
    if (!isTaskDue(task, now)) continue;
    estimated += task.estimatedMinutes;
    studied += resolveStudyMinutes(
      task.studySessions,
      task.recalledStudyMinutes,
    );
  }
  if (estimated === 0) return { studiedMinutes: null, estimatedMinutes: null };
  return { studiedMinutes: studied, estimatedMinutes: estimated };
}

export function sumPostponed(tasks: RiskTaskRow[]): number {
  return tasks.reduce((sum, task) => sum + task.postponedCount, 0);
}

/**
 * Percentagem de faltas da cadeira, somando todos os textos de horario
 * ligados a ela. null se nao ha aulas dadas suficientes (com poucas aulas
 * 1 falta ja seria uma percentagem enorme).
 */
export function areaAbsenceShare(rows: SubjectAttendance[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce(
    (acc, row) => ({
      subject: acc.subject,
      attended: acc.attended + row.attended,
      missed: acc.missed + row.missed,
      unmarked: acc.unmarked + row.unmarked,
    }),
    { subject: '', attended: 0, missed: 0, unmarked: 0 },
  );
  const held = total.attended + total.missed + total.unmarked;
  if (held < MIN_HELD_CLASSES) return null;
  return absenceShare(total);
}
