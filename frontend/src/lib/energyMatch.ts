// Escolhe a task do modo "uma so task" a pensar na energia do check-in de
// hoje (1-5). Energia baixa prefere tasks leves, alta prefere pesadas, media
// nao muda nada. Tasks em atraso ganham sempre: a energia nunca esconde o
// que ja passou do prazo. Sem esforco definido conta como compativel.
import type { Effort, Task } from '../types/models';
import { getDateStatus } from '../utils/taskDateStatus';
import { mostUrgentTask } from './mostUrgentTask';

export type EnergyBand = 'low' | 'mid' | 'high';

// Energia <= LOW_MAX e baixa, >= HIGH_MIN e alta.
export const ENERGY_LOW_MAX = 2;
export const ENERGY_HIGH_MIN = 4;

const FITS: Record<EnergyBand, readonly Effort[] | null> = {
  low: ['LIGHT', 'MODERATE'],
  mid: null,
  high: ['HEAVY', 'EXHAUSTIVE'],
};

export function energyBand(energy: number | null | undefined): EnergyBand {
  if (energy == null) return 'mid';
  if (energy <= ENERGY_LOW_MAX) return 'low';
  if (energy >= ENERGY_HIGH_MIN) return 'high';
  return 'mid';
}

export interface EnergyPick {
  task: Task | null;
  // true quando a energia mudou a escolha face a ordem de urgencia normal.
  byEnergy: boolean;
}

export function pickForEnergy(tasks: readonly Task[], energy: number | null | undefined, now: Date = new Date()): EnergyPick {
  const urgent = mostUrgentTask(tasks, now);
  const fits = FITS[energyBand(energy)];
  if (!urgent || !fits || getDateStatus(urgent, now) === 'overdue') return { task: urgent, byEnergy: false };
  const matching = tasks.filter((t) => t.effort == null || fits.includes(t.effort));
  const pick = mostUrgentTask(matching, now);
  if (!pick) return { task: urgent, byEnergy: false };
  return { task: pick, byEnergy: pick.id !== urgent.id };
}
