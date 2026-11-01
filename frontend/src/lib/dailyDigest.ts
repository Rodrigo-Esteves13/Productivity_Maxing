import type { Task } from '../types/models';
import { getDateStatus } from '../utils/taskDateStatus';
import { taskDayKey, todayKey as localTodayKey } from './dateKey';
import { upcomingExams } from './examMode';
import { MS_PER_DAY } from './timeConstants';

// Resumo diario (uma vez por dia, no Dashboard). Tudo aqui e puro: o "agora"
// entra por parametro para os testes fixarem o dia.

/** Acima disto o proximo teste ja nao e noticia do dia. */
export const EXAM_HORIZON_DAYS = 30;

const SLOT_KEY_PREFIX = 'pm-daily-digest-';

export interface DigestLine {
  /** Chave i18n (namespace dailyDigest). */
  key: string;
  params: Record<string, string | number>;
}

export interface DigestInput {
  dueToday: number;
  overdue: number;
  classesToday: number;
  /** Proximo teste/exame e quantos dias faltam (0 = hoje); null se nao houver. */
  exam: { title: string; days: number } | null;
}

const MAX_LINES = 3;

/** Linhas do resumo por ordem fixa: tasks, teste, aulas. null = nada a dizer. */
export function buildDigest(input: DigestInput): DigestLine[] | null {
  const lines: DigestLine[] = [];
  const { dueToday, overdue, classesToday, exam } = input;

  if (dueToday > 0 && overdue > 0) {
    lines.push({ key: 'dailyDigest.tasksBoth', params: { due: dueToday, overdue } });
  } else if (dueToday > 0) {
    lines.push({ key: 'dailyDigest.tasksDue', params: { count: dueToday } });
  } else if (overdue > 0) {
    lines.push({ key: 'dailyDigest.tasksOverdue', params: { count: overdue } });
  }

  if (exam) {
    if (exam.days <= 0) lines.push({ key: 'dailyDigest.examToday', params: { title: exam.title } });
    else if (exam.days === 1) lines.push({ key: 'dailyDigest.examTomorrow', params: { title: exam.title } });
    else lines.push({ key: 'dailyDigest.examSoon', params: { title: exam.title, days: exam.days } });
  }

  if (classesToday > 0) {
    lines.push({ key: 'dailyDigest.classes', params: { count: classesToday } });
  }

  return lines.length > 0 ? lines.slice(0, MAX_LINES) : null;
}

function dayNumber(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / MS_PER_DAY);
}

/** Dias de calendario ate a data da task (chave local/UTC como o resto da app). */
export function daysUntilTask(task: Task, now: Date): number {
  return dayNumber(taskDayKey(new Date(task.date))) - dayNumber(localTodayKey(now));
}

/** Teste/exame mais proximo dentro do horizonte, ou null. */
export function nearestExam(tasks: Task[], now: Date): DigestInput['exam'] {
  const next = upcomingExams(tasks, localTodayKey(now))[0];
  if (!next) return null;
  const days = daysUntilTask(next, now);
  return days <= EXAM_HORIZON_DAYS ? { title: next.title, days } : null;
}

/** Tasks por fazer cujo dia ja passou. */
export function countOverdue(tasks: Task[], now: Date): number {
  return tasks.filter((task) => getDateStatus(task, now) === 'overdue').length;
}

// ---- Vaga diaria (localStorage, so deste dispositivo) ----

function slotKey(dayKey: string): string {
  return `${SLOT_KEY_PREFIX}${dayKey}`;
}

export function isSlotUsed(dayKey: string): boolean {
  try {
    return localStorage.getItem(slotKey(dayKey)) !== null;
  } catch {
    return false;
  }
}

/** Marca o dia como usado e apaga as marcas de dias anteriores. */
export function consumeSlot(dayKey: string): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(SLOT_KEY_PREFIX)) localStorage.removeItem(key);
    }
    localStorage.setItem(slotKey(dayKey), '1');
  } catch {
    // Sem storage: o resumo pode voltar a aparecer numa recarga; nada parte.
  }
}

export function clearSlot(dayKey: string): void {
  try {
    localStorage.removeItem(slotKey(dayKey));
  } catch {
    // Best-effort.
  }
}
