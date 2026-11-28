// Tempo ativo e classificacao de uma tentativa.

import type { Quiz, QuizQuestion } from './quizFormat';
import { type QuizMode, MS_PER_SECOND, type SessionItem, type QuizSession } from './quizSessionTypes';
import { isAnswered } from './quizGrading';

// ---------------------------------------------------------------------------
// Historico inteligente. Contrato usado por QuizRunner, QuizDetail e o backend
// (QuizAttempt.planned):
// - touchSession em cada interacao: soma o tempo desde a ultima, no maximo
//   QUIZ_IDLE_GAP_MS (10 min parado numa pergunta conta 2 min).
// - heartbeatSession a cada QUIZ_HEARTBEAT_MS enquanto a pagina esta aberta.
// - resumeSession ao voltar a abrir a tentativa: se a pagina esteve fechada
//   (salto > QUIZ_HEARTBEAT_GRACE_MS), o relogio do exame fica parado esse tempo.
// - classifyAttempt no fim: 'discard' (curta demais ou sem respostas, nao grava),
//   'partial' (so as respondidas contam) ou 'complete' (em branco conta errada).
// ---------------------------------------------------------------------------
export const QUIZ_IDLE_GAP_MS = 2 * 60 * MS_PER_SECOND;
export const QUIZ_HEARTBEAT_MS = 5 * MS_PER_SECOND;
export const QUIZ_HEARTBEAT_GRACE_MS = 20 * MS_PER_SECOND;
export const QUIZ_MIN_ATTEMPT_MS = 15 * MS_PER_SECOND;
export const QUIZ_MIN_ANSWERED = 1;

export type AttemptOutcome = 'complete' | 'partial' | 'discard';

// O tempo desde a ultima interacao vai para a pergunta aberta (session.index):
// mudar de pergunta tem de chamar isto antes de mudar o indice.
export function touchSession(session: QuizSession, now: number = Date.now()): QuizSession {
  const last = session.lastActiveAt ?? session.startedAt;
  const gap = Math.max(0, Math.min(now - last, QUIZ_IDLE_GAP_MS));
  const items = gap === 0 ? session.items : session.items.map((it, i) => (i === session.index ? { ...it, timeMs: it.timeMs + gap } : it));
  return { ...session, items, activeMs: (session.activeMs ?? 0) + gap, lastActiveAt: now, lastSeenAt: now };
}

export const heartbeatSession = (session: QuizSession, now: number = Date.now()): QuizSession => ({ ...session, lastSeenAt: now });

export function resumeSession(session: QuizSession, now: number = Date.now()): QuizSession {
  const seen = session.lastSeenAt ?? session.lastActiveAt ?? now;
  const away = now - seen;
  if (away <= QUIZ_HEARTBEAT_GRACE_MS) return session;
  // Pagina fechada: o exame nao gasta tempo, e a pausa nao conta como ativa.
  return {
    ...session,
    deadline: session.deadline === null ? null : session.deadline + away,
    lastActiveAt: now,
    lastSeenAt: now,
  };
}

// Respondida de verdade: na pratica confirmada; no exame mexida e completa.
export function wasAnswered(question: QuizQuestion, item: SessionItem, mode: QuizMode): boolean {
  if (mode !== 'exam') return item.checked;
  return (item.touched ?? false) && isAnswered(question, item.response);
}

export interface AttemptClassification {
  outcome: AttemptOutcome;
  answeredIds: string[];
  activeMs: number;
  planned: number;
}

// countBlanks: o aluno escolheu terminar com as em branco a contar como erradas
// (senao uma tentativa a meio so conta as respondidas, com o tempo usado).
export function classifyAttempt(quiz: Quiz, session: QuizSession, now: number = Date.now(), countBlanks = false): AttemptClassification {
  const byId = new Map(quiz.questions.map((q) => [q.id, q]));
  const answeredIds = session.items.flatMap((item) => {
    const q = byId.get(item.id);
    return q && wasAnswered(q, item, session.mode) ? [item.id] : [];
  });
  const activeMs = touchSession(session, now).activeMs ?? 0;
  const planned = session.items.length;
  if (answeredIds.length < QUIZ_MIN_ANSWERED || activeMs < QUIZ_MIN_ATTEMPT_MS) return { outcome: 'discard', answeredIds, activeMs, planned };
  // Exame que acabou o tempo com o aluno presente: tudo conta (em branco = errada).
  const lastActive = session.lastActiveAt ?? session.startedAt;
  const timedOutWhileActive = session.deadline !== null && now >= session.deadline && session.deadline - lastActive <= QUIZ_IDLE_GAP_MS;
  const outcome = answeredIds.length === planned || timedOutWhileActive || countBlanks ? 'complete' : 'partial';
  return { outcome, answeredIds, activeMs, planned };
}

// Tentativa parcial: so as perguntas respondidas entram na nota e no historico.
export function answeredOnly(session: QuizSession, answeredIds: readonly string[]): QuizSession {
  const keep = new Set(answeredIds);
  return { ...session, items: session.items.filter((item) => keep.has(item.id)) };
}
