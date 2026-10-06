// Contagem decrescente / pomodoro por cima da sessao de Focus. A sessao no
// servidor continua a ser um cronometro normal; o plano (quanto tempo de
// foco, quanto de pausa) vive so no browser, por sessao.

export interface TimerPlan {
  focusMinutes: number;
  breakMinutes: number;
}

export const TIMER_PRESETS: { label: string; plan: TimerPlan }[] = [
  { label: '25 + 5', plan: { focusMinutes: 25, breakMinutes: 5 } },
  { label: '50 + 10', plan: { focusMinutes: 50, breakMinutes: 10 } },
  { label: '90 + 15', plan: { focusMinutes: 90, breakMinutes: 15 } },
];

export const MIN_FOCUS_MINUTES = 5;
export const MAX_FOCUS_MINUTES = 240;
export const MAX_BREAK_MINUTES = 60;

/** Plano valido (limites respeitados), ou null. Serve para validar texto livre. */
export function normalizePlan(focusMinutes: number, breakMinutes: number): TimerPlan | null {
  const focus = Math.round(focusMinutes);
  const rest = Math.round(breakMinutes);
  if (!Number.isFinite(focus) || !Number.isFinite(rest)) return null;
  if (focus < MIN_FOCUS_MINUTES || focus > MAX_FOCUS_MINUTES) return null;
  if (rest < 0 || rest > MAX_BREAK_MINUTES) return null;
  return { focusMinutes: focus, breakMinutes: rest };
}

/** Segundos que faltam para acabar o bloco de foco; null sem plano; nunca negativo. */
export function remainingSeconds(elapsedSeconds: number, plan: TimerPlan | null): number | null {
  if (!plan) return null;
  return Math.max(0, plan.focusMinutes * 60 - elapsedSeconds);
}

// ---- Persistencia (localStorage; falha em silencio se nao existir) ----

const PLAN_KEY_PREFIX = 'pmaxing:focus-plan:';
const BREAK_KEY = 'pmaxing:focus-break';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Sem localStorage: o temporizador funciona na mesma ate recarregar.
  }
}

function parsePlan(raw: string | null): TimerPlan | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TimerPlan>;
    return normalizePlan(Number(value.focusMinutes), Number(value.breakMinutes));
  } catch {
    return null;
  }
}

export const loadPlan = (sessionId: string): TimerPlan | null => parsePlan(safeGet(PLAN_KEY_PREFIX + sessionId));
export const savePlan = (sessionId: string, plan: TimerPlan): void =>
  safeSet(PLAN_KEY_PREFIX + sessionId, JSON.stringify(plan));
export const clearPlan = (sessionId: string): void => safeSet(PLAN_KEY_PREFIX + sessionId, null);

// Uma pausa a decorrer e o que fazer quando acabar (recomecar com a mesma task).
export interface ResumeSpec {
  taskId?: string;
  areaId?: string;
  plan: TimerPlan;
}

export interface RestBreak {
  endsAt: number; // ms desde 1970
  resume: ResumeSpec | null;
}

export function loadBreak(): RestBreak | null {
  const raw = safeGet(BREAK_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as RestBreak;
    return typeof value.endsAt === 'number' && Number.isFinite(value.endsAt) ? value : null;
  } catch {
    return null;
  }
}

export const saveBreak = (rest: RestBreak): void => safeSet(BREAK_KEY, JSON.stringify(rest));
export const clearBreak = (): void => safeSet(BREAK_KEY, null);

/** Segundos que faltam da pausa (>= 0). */
export function breakRemainingSeconds(rest: RestBreak, nowMs: number): number {
  return Math.max(0, Math.ceil((rest.endsAt - nowMs) / 1000));
}
