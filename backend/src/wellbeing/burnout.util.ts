import {
  BURNOUT_BASELINE_DAYS,
  BURNOUT_DROP_THRESHOLD,
  BURNOUT_LOAD_HELD_RATIO,
  BURNOUT_MIN_BASELINE_LOGS,
  BURNOUT_MIN_RECENT_LOGS,
  BURNOUT_RECENT_DAYS,
} from './wellbeing.constants';

// Um check-in diario, contado em dias antes de hoje (0 = hoje).
export interface BurnoutLog {
  daysAgo: number;
  mood: number;
  energy: number | null;
  stress: number | null;
}

export type BurnoutSignal =
  'moodDrop' | 'energyDrop' | 'stressRise' | 'loadHeld';

export type BurnoutResult =
  | { kind: 'not_enough_data'; recentLogs: number; baselineLogs: number }
  | { kind: 'ok'; signals: BurnoutSignal[] }
  | {
      kind: 'warning';
      signals: BurnoutSignal[];
      recentMood: number;
      baselineMood: number;
      recentStudyMinutesPerDay: number;
      baselineStudyMinutesPerDay: number;
    };

const round1 = (n: number) => Math.round(n * 10) / 10;

function average(values: (number | null)[]): number | null {
  const real = values.filter((v): v is number => v !== null);
  return real.length > 0 ? real.reduce((s, v) => s + v, 0) / real.length : null;
}

// Diferenca recente - base, so quando os dois lados tem valores.
function delta(
  recent: BurnoutLog[],
  baseline: BurnoutLog[],
  pick: (l: BurnoutLog) => number | null,
): number | null {
  const r = average(recent.map(pick));
  const b = average(baseline.map(pick));
  return r !== null && b !== null ? r - b : null;
}

// "Continua a trabalhar o mesmo (ou mais) mas sente-se pior": compara os
// ultimos BURNOUT_RECENT_DAYS dias com as BURNOUT_BASELINE_DAYS dias antes.
// So avisa quando ha uma queda de humor/energia E (carga mantida OU stress
// a subir) - uma semana triste sem trabalho a mais nao e burnout.
export function detectBurnout(
  logs: BurnoutLog[],
  studyMinutesRecent: number,
  studyMinutesBaseline: number,
): BurnoutResult {
  const recent = logs.filter((l) => l.daysAgo < BURNOUT_RECENT_DAYS);
  const baseline = logs.filter(
    (l) =>
      l.daysAgo >= BURNOUT_RECENT_DAYS &&
      l.daysAgo < BURNOUT_RECENT_DAYS + BURNOUT_BASELINE_DAYS,
  );
  if (
    recent.length < BURNOUT_MIN_RECENT_LOGS ||
    baseline.length < BURNOUT_MIN_BASELINE_LOGS
  ) {
    return {
      kind: 'not_enough_data',
      recentLogs: recent.length,
      baselineLogs: baseline.length,
    };
  }

  const recentPerDay = studyMinutesRecent / BURNOUT_RECENT_DAYS;
  const baselinePerDay = studyMinutesBaseline / BURNOUT_BASELINE_DAYS;
  const moodDelta = delta(recent, baseline, (l) => l.mood) ?? 0;
  const energyDelta = delta(recent, baseline, (l) => l.energy);
  const stressDelta = delta(recent, baseline, (l) => l.stress);

  const checks: Record<BurnoutSignal, boolean> = {
    moodDrop: moodDelta <= -BURNOUT_DROP_THRESHOLD,
    energyDrop: energyDelta !== null && energyDelta <= -BURNOUT_DROP_THRESHOLD,
    stressRise: stressDelta !== null && stressDelta >= BURNOUT_DROP_THRESHOLD,
    loadHeld:
      recentPerDay > 0 &&
      recentPerDay >= baselinePerDay * BURNOUT_LOAD_HELD_RATIO,
  };
  const signals = (Object.keys(checks) as BurnoutSignal[]).filter(
    (k) => checks[k],
  );
  const feelsWorse = checks.moodDrop || checks.energyDrop;
  const underPressure = checks.loadHeld || checks.stressRise;

  if (!feelsWorse || !underPressure) return { kind: 'ok', signals };
  return {
    kind: 'warning',
    signals,
    recentMood: round1(average(recent.map((l) => l.mood)) ?? 0),
    baselineMood: round1(average(baseline.map((l) => l.mood)) ?? 0),
    recentStudyMinutesPerDay: Math.round(recentPerDay),
    baselineStudyMinutesPerDay: Math.round(baselinePerDay),
  };
}
