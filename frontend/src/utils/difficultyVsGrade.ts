import type { Difficulty, Task } from '../types/models';

export const DIFFICULTY_ORDER: Difficulty[] = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];
const EASY_SIDE: Difficulty[] = ['VERY_EASY', 'EASY'];
const HARD_SIDE: Difficulty[] = ['HARD', 'VERY_HARD'];

export interface DifficultyGradeBucket {
  difficulty: Difficulty;
  count: number;
  // Media das notas reais; null sem nenhuma avaliada neste nivel.
  averageGrade: number | null;
  // Media de (nota real - meta), so nas que tem meta; null sem nenhuma.
  averageVsTarget: number | null;
}

export interface DifficultyVsGrade {
  buckets: DifficultyGradeBucket[];
  gradedCount: number;
  // Media das dificeis menos media das faceis (negativo = notas piores nas
  // que marcaste como dificeis). null sem os dois lados.
  hardMinusEasy: number | null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const avg = (values: number[]) =>
  values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : null;
const hasValue = (v: number | null | undefined): v is number => v !== null && v !== undefined;

// Dificuldade marcada ao criar a task vs a nota que saiu.
export function computeDifficultyVsGrade(tasks: Task[]): DifficultyVsGrade {
  const graded = tasks.filter((t) => hasValue(t.realGrade));
  const buckets = DIFFICULTY_ORDER.map((difficulty): DifficultyGradeBucket => {
    const inLevel = graded.filter((t) => t.difficulty === difficulty);
    const grade = avg(inLevel.map((t) => t.realGrade as number));
    const withTarget = inLevel.filter((t) => hasValue(t.targetGrade));
    const vsTarget = avg(withTarget.map((t) => (t.realGrade as number) - (t.targetGrade as number)));
    return {
      difficulty,
      count: inLevel.length,
      averageGrade: grade === null ? null : round1(grade),
      averageVsTarget: vsTarget === null ? null : round1(vsTarget),
    };
  });
  const sideAverage = (side: Difficulty[]) =>
    avg(graded.filter((t) => side.includes(t.difficulty)).map((t) => t.realGrade as number));
  const easy = sideAverage(EASY_SIDE);
  const hard = sideAverage(HARD_SIDE);
  return {
    buckets,
    gradedCount: graded.length,
    hardMinusEasy: easy !== null && hard !== null ? round1(hard - easy) : null,
  };
}
