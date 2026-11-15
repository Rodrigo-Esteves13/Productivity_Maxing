import { useCallback, useEffect, useState } from 'react';
import { mergeSentIds, parseStoredSession, QUIZ_CARDS_SENT_MAX_QUIZZES, type QuizSession } from '../lib/quizSession';

// Tentativa a meio, guardada neste dispositivo para um refresh nao a perder
// (o quiz em si fica na conta). So uma de cada vez.
export const QUIZ_SESSION_STORAGE_KEY = 'pm-quiz-session';

// Remove a sessao guardada (tambem usado quando uma sessao estragada rebenta a pagina).
export function clearStoredQuizSession(): void {
  try {
    localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
  } catch {
    // Sem storage: nada a limpar.
  }
}

// Forma invalida = lixo ou adulterada: apaga a chave para nunca mais rebentar a pagina.
// O quiz so e conhecido depois de carregar, a QuizDetail confere os ids e indices.
function read(quizId: string): QuizSession | null {
  try {
    const raw = localStorage.getItem(QUIZ_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    const session = typeof stored === 'object' && stored !== null ? parseStoredSession((stored as { session?: unknown }).session, null) : null;
    if (!session) {
      localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
      return null;
    }
    return (stored as { quizId?: unknown }).quizId === quizId ? session : null;
  } catch {
    clearStoredQuizSession();
    return null;
  }
}

export function useQuizSession(quizId: string) {
  const [session, setSession] = useState<QuizSession | null>(() => read(quizId));

  useEffect(() => {
    try {
      if (session) localStorage.setItem(QUIZ_SESSION_STORAGE_KEY, JSON.stringify({ quizId, session }));
      else if (read(quizId)) localStorage.removeItem(QUIZ_SESSION_STORAGE_KEY);
    } catch {
      // Sem storage (modo privado): a tentativa fica so em memoria.
    }
  }, [quizId, session]);

  const clear = useCallback(() => setSession(null), []);
  return { session, setSession, clear };
}

// Erradas ja enviadas para as flashcards: quizId -> ids das perguntas. So neste
// dispositivo, com limite de tamanho (ver quizSession.ts).
const SENT_KEY = 'pm-quiz-cards-sent';

function readSentMap(): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

export function useQuizCardsSent(quizId: string) {
  const [sent, setSent] = useState<string[]>(() => {
    const list = readSentMap()[quizId];
    return Array.isArray(list) ? list.filter((id) => typeof id === 'string') : [];
  });

  const markSent = useCallback(
    (ids: string[]) => {
      const next = mergeSentIds(sent, ids);
      setSent(next);
      try {
        const all = readSentMap();
        delete all[quizId];
        const kept = Object.entries({ ...all, [quizId]: next }).slice(-QUIZ_CARDS_SENT_MAX_QUIZZES);
        localStorage.setItem(SENT_KEY, JSON.stringify(Object.fromEntries(kept)));
      } catch {
        // Sem storage: so vale nesta sessao.
      }
    },
    [quizId, sent],
  );

  return { sent, markSent };
}
