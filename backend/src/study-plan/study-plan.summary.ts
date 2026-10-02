import type { CapacityStatus } from './study-plan.types';

interface CapacityTotals {
  neededMinutes: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
}

// Primeira regra que casar ganha; a última apanha tudo.
const STATUS_RULES: {
  status: CapacityStatus;
  matches: (totals: CapacityTotals) => boolean;
}[] = [
  { status: 'no_work', matches: (t) => t.neededMinutes === 0 },
  { status: 'short', matches: (t) => t.shortfallMinutes > 0 },
  { status: 'overtime', matches: (t) => t.overtimeMinutes > 0 },
  { status: 'on_track', matches: () => true },
];

export function resolveCapacityStatus(totals: CapacityTotals): CapacityStatus {
  return (
    STATUS_RULES.find((rule) => rule.matches(totals))?.status ?? 'on_track'
  );
}
