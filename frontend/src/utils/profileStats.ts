import type { Task } from '../types/models';
import { DEFAULT_STREAK_REST_MODE, type StreakRestMode } from '../lib/streakRest';

// "Project" não é uma Area, é um TaskType como outro qualquer (ex: "PROJETO"),
// configurável pelo admin em /admin/task-types. Como a key exata é dinâmica,
// identificamos aqui por key/label que contenha "proj". Se o teu TaskType de
// projeto tiver uma key diferente (ex: "TRABALHO_FINAL"), troca este regex.
export const PROJECT_TYPE_PATTERN = /proj/i;

// Chave de dia em fuso horário LOCAL (não UTC). "toISOString()" converte
// para UTC antes de cortar a data, o que dá o dia errado sempre que a hora
// local estiver perto da meia-noite e o fuso não for UTC+0 (ex: 00:30 em
// Lisboa/Porto no horário de verão vira "ontem" em UTC). Isto causava
// streaks a partir ou a quebrar sozinhas perto da meia-noite.
export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ProfileStats {
  completed: number;
  active: number;
  projects: number;
  streak: number;
  // Dias perdoados (descanso) dentro da streak atual; nao somam nem quebram.
  restDaysUsed: number;
  // Sem atividade hoje, streak > 0 e hoje nao e dia perdoado.
  streakAtRisk: boolean;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// Segunda-feira (chave local) da semana civil Seg-Dom que contem o dia.
function weekStartKey(date: Date): string {
  const sinceMonday = (date.getDay() + 6) % 7;
  return toLocalDayKey(addDays(date, -sinceMonday));
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

interface StreakState {
  streak: number;
  forgiven: string[];
  usedWeeks: Set<string>;
  todayDone: boolean;
}

// Simulacao para a frente: do primeiro dia com atividade ate ontem; hoje so
// conta se ja tiver atividade (hoje por fazer nunca quebra a streak).
function simulateStreak(doneDayKeys: Set<string>, mode: StreakRestMode, now: Date): StreakState {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toLocalDayKey(today);
  const past = [...doneDayKeys].filter((k) => k < todayKey).sort();
  const state: StreakState = {
    streak: 0,
    forgiven: [],
    usedWeeks: new Set(),
    todayDone: doneDayKeys.has(todayKey),
  };
  if (past.length > 0) {
    for (let cursor = parseDayKey(past[0]); toLocalDayKey(cursor) < todayKey; cursor = addDays(cursor, 1)) {
      const key = toLocalDayKey(cursor);
      if (doneDayKeys.has(key)) {
        state.streak += 1;
      } else if (mode === 'weekends' && isWeekend(cursor)) {
        state.forgiven.push(key);
      } else if (mode === 'weeklyFreeze' && !state.usedWeeks.has(weekStartKey(cursor))) {
        state.usedWeeks.add(weekStartKey(cursor));
        state.forgiven.push(key);
      } else {
        state.streak = 0;
        state.forgiven = [];
      }
    }
  }
  if (state.todayDone) state.streak += 1;
  return state;
}

export interface StreakResult {
  streak: number;
  restDaysUsed: number;
  atRisk: boolean;
}

export function computeStreak(
  doneDayKeys: Set<string>,
  mode: StreakRestMode = DEFAULT_STREAK_REST_MODE,
  now: Date = new Date()
): StreakResult {
  const state = simulateStreak(doneDayKeys, mode, now);
  // Perdoados no fim (sem atividade depois) nao pertencem a streak mostrada.
  const lastDone = [...doneDayKeys].filter((k) => k <= toLocalDayKey(now)).sort().pop();
  const restDaysUsed = state.forgiven.filter((k) => lastDone !== undefined && k < lastDone).length;
  return { streak: state.streak, restDaysUsed, atRisk: isAtRisk(state, mode, now) };
}

function isAtRisk(state: StreakState, mode: StreakRestMode, now: Date): boolean {
  if (state.todayDone || state.streak <= 0) return false;
  if (mode === 'weekends' && isWeekend(now)) return false;
  if (mode === 'weeklyFreeze' && !state.usedWeeks.has(weekStartKey(now))) return false;
  return true;
}

export function streakAtRisk(
  doneDayKeys: Set<string>,
  mode: StreakRestMode = DEFAULT_STREAK_REST_MODE,
  now: Date = new Date()
): boolean {
  return isAtRisk(simulateStreak(doneDayKeys, mode, now), mode, now);
}

export function computeProfileStats(
  tasks: Task[],
  projectTypeKeys: Set<string>,
  mode: StreakRestMode = DEFAULT_STREAK_REST_MODE,
  now: Date = new Date()
): ProfileStats {
  const completedTasks = tasks.filter((t) => t.progressStatus === 'COMPLETED');
  const completed = completedTasks.length;
  const active = tasks.length - completed;
  const projects = tasks.filter((t) => projectTypeKeys.has(t.type)).length;

  // O backend guarda "completedAt" (momento real da conclusao); tasks antigas
  // sem ele usam "date" como fallback para a streak nao desaparecer.
  const doneDayKeys = new Set(
    completedTasks.map((t) => toLocalDayKey(new Date(t.completedAt ?? t.date)))
  );
  const { streak, restDaysUsed, atRisk } = computeStreak(doneDayKeys, mode, now);
  return { completed, active, projects, streak, restDaysUsed, streakAtRisk: atRisk };
}

export function extractProjectTypeKeys(taskTypes: { key: string; label: string }[]): Set<string> {
  return new Set(
    taskTypes
      .filter((t) => PROJECT_TYPE_PATTERN.test(t.key) || PROJECT_TYPE_PATTERN.test(t.label))
      .map((t) => t.key)
  );
}
