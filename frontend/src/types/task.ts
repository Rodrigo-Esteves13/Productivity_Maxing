export type Difficulty = "FACIL" | "MEDIO" | "DIFICIL" | "MUITO_DIFICIL";
export type ProgressStatus = "ADIANTADO" | "TEMPO_ESPERADO" | "ATRASADO" | "MUITO_ATRASADO";

export interface Task {
  id: string;
  title: string;
  area: string;
  date: string;
  weightPercentage: number;
  difficulty: Difficulty;
  progressStatus: ProgressStatus;
  targetGrade: number;
  realGrade: number | null;
}