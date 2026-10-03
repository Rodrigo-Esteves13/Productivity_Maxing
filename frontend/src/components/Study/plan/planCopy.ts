import type { CapacityStatus } from '../../../types/models';
import { formatDuration } from '../../../lib/timeFormat';

interface BannerContext {
  neededMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
  dailyLimitMinutes: number;
}

interface BannerCopy {
  title: string;
  body: (ctx: BannerContext) => string;
  // Tokens de cor existentes (neutral/amber/red/emerald), nunca hex novos.
  containerClass: string;
  titleClass: string;
}

// Tabela em vez de if/switch: cada estado da capacidade tem o seu texto
// e cor, e acrescentar um novo estado é acrescentar uma entrada.
export const BANNER_BY_STATUS: Record<CapacityStatus, BannerCopy> = {
  no_work: {
    title: 'Nothing to plan',
    body: () => 'No pending tasks are due in this window.',
    containerClass: 'border-neutral-800 bg-neutral-900/50',
    titleClass: 'text-neutral-200',
  },
  on_track: {
    title: 'On track',
    body: (c) =>
      `${formatDuration(c.neededMinutes)} of study fits inside your ${formatDuration(c.dailyLimitMinutes)} daily limit.`,
    containerClass: 'border-emerald-900/50 bg-emerald-950/20',
    titleClass: 'text-emerald-300',
  },
  overtime: {
    title: 'You should plan overtime',
    body: (c) =>
      `${formatDuration(c.overtimeMinutes)} only fits by going past your ${formatDuration(c.dailyLimitMinutes)} daily limit. Blocks marked overtime are the ones to protect or move.`,
    containerClass: 'border-amber-900/50 bg-amber-950/20',
    titleClass: 'text-amber-300',
  },
  short: {
    title: 'Not enough time',
    body: (c) =>
      `${formatDuration(c.shortfallMinutes)} cannot be scheduled before the deadlines, even with overtime. Free up time, move a deadline or drop a task.`,
    containerClass: 'border-red-900/50 bg-red-950/20',
    titleClass: 'text-red-300',
  },
};

export const ESTIMATE_SOURCE_LABEL = {
  manual: 'Your estimate',
  manual_calibrated: 'Your estimate, adjusted',
  predicted: 'Predicted',
  course_history: 'From your past tasks here',
  default: 'Default guess',
} as const;
