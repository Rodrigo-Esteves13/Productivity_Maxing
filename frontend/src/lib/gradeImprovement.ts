import type { CreditsAreaSummary } from '../types/models';

// Subidas de nota simuladas (em valores da escala).
export const IMPROVEMENT_DELTAS = [1, 2] as const;
const ROUND_FACTOR = 100;

export interface ImprovementRow {
  areaId: string;
  areaName: string;
  grade: number;
  credits: number | null;
  // Quanto a media do periodo sobe por cada delta de IMPROVEMENT_DELTAS.
  gains: number[];
}

const weightOf = (area: CreditsAreaSummary) => area.credits ?? 1;
const round = (value: number) => Math.round(value * ROUND_FACTOR) / ROUND_FACTOR;

// Cadeiras aprovadas ordenadas pelo quanto a media do periodo sobe se a nota
// subir +1 / +2 (peso x subida / pesos totais, a nota nunca passa do maximo
// da escala). So simula: nao diz se a melhoria e permitida.
export function gradeImprovements(areas: CreditsAreaSummary[], maxGrade: number): ImprovementRow[] {
  const graded = areas.filter((a) => a.average !== null);
  const totalWeight = graded.reduce((sum, a) => sum + weightOf(a), 0);
  if (totalWeight === 0) return [];

  const rows: ImprovementRow[] = [];
  for (const area of graded) {
    const grade = area.average as number;
    if (!area.passed || grade >= maxGrade || weightOf(area) === 0) continue;
    rows.push({
      areaId: area.areaId,
      areaName: area.areaName,
      grade,
      credits: area.credits,
      gains: IMPROVEMENT_DELTAS.map((delta) =>
        round((weightOf(area) * Math.max(0, Math.min(delta, maxGrade - grade))) / totalWeight),
      ),
    });
  }
  const best = (row: ImprovementRow) => row.gains[row.gains.length - 1];
  return rows.sort((a, b) => best(b) - best(a) || a.areaName.localeCompare(b.areaName));
}
