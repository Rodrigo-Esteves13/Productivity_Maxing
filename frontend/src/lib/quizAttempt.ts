import type { Quiz } from './quizFormat';
import { answeredOnly, classifyAttempt, scoreSession, touchSession, type QuizSession } from './quizSession';

// Corrige a tentativa; null se a sessao guardada rebentar a correcao.
export function judgeAttempt(quiz: Quiz, session: QuizSession, now: number, countBlanks = false) {
  try {
    // O tempo ate agora vai para a pergunta aberta antes de corrigir.
    const touched = touchSession(session, now);
    const verdict = classifyAttempt(quiz, touched, now, countBlanks);
    const done = { ...touched, finishedAt: now, activeMs: verdict.activeMs };
    const counted = verdict.outcome === 'partial' ? answeredOnly(done, verdict.answeredIds) : done;
    return { verdict, done, counted, result: scoreSession(quiz, counted) };
  } catch {
    return null;
  }
}
