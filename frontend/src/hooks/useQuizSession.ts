import { useCallback, useEffect, useState } from 'react';
import type { QuizResponse } from '../lib/quizFormat';
import {
  mergeSentIds,
  parseStoredResponse,
  parseStoredSession,
  QUIZ_CARDS_SENT_MAX_QUIZZES,
  SESSION_MAX_ITEMS,
  type QuizSession,
} from '../lib/quizSession';
import { ACCOUNT_SCOPED_KEYS, accountStorageKey } from '../lib/storageKeys';

// Tudo aqui fica neste browser, separado por conta (accountStorageKey).
// Tentativa a meio, guardada para um refresh nao a perder (o quiz em si fica
// na conta). So uma de cada vez.
const sessionKey = (): string => accountStorageKey(ACCOUNT_SCOPED_KEYS.quizSession);

// Remove a sessao guardada (tambem usado quando uma sessao estragada rebenta a pagina).
export function clearStoredQuizSession(): void {
  try {
    localStorage.removeItem(sessionKey());
  } catch {
    // Sem storage: nada a limpar.
  }
}

// Forma invalida = lixo ou adulterada: apaga a chave para nunca mais rebentar a pagina.
// O quiz so e conhecido depois de carregar, a QuizDetail confere os ids e indices.
function read(quizId: string): QuizSession | null {
  try {
    const raw = localStorage.getItem(sessionKey());
    if (!raw) return null;
    const stored: unknown = JSON.parse(raw);
    const session = typeof stored === 'object' && stored !== null ? parseStoredSession((stored as { session?: unknown }).session, null) : null;
    if (!session) {
      localStorage.removeItem(sessionKey());
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
      if (session) localStorage.setItem(sessionKey(), JSON.stringify({ quizId, session }));
      else if (read(quizId)) localStorage.removeItem(sessionKey());
    } catch {
      // Sem storage (modo privado): a tentativa fica so em memoria.
    }
  }, [quizId, session]);

  const clear = useCallback(() => setSession(null), []);
  return { session, setSession, clear };
}

// Erradas ja enviadas para as flashcards: quizId -> ids das perguntas. So neste
// dispositivo, com limite de tamanho (ver quizSession.ts).
const sentKey = (): string => accountStorageKey(ACCOUNT_SCOPED_KEYS.quizCardsSent);

function readSentMap(): Record<string, string[]> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(sentKey()) ?? '{}');
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
        localStorage.setItem(sentKey(), JSON.stringify(Object.fromEntries(kept)));
      } catch {
        // Sem storage: so vale nesta sessao.
      }
    },
    [quizId, sent],
  );

  return { sent, markSent };
}

// Mapas por quiz neste dispositivo (quizId -> valor), com limite de quizzes.
// O que vem do storage nunca e confiado: quem le valida cada valor.
function readQuizMap(base: string): Map<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(accountStorageKey(base)) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? new Map(Object.entries(parsed)) : new Map();
  } catch {
    return new Map();
  }
}

function writeQuizMap(base: string, quizId: string, value: unknown): void {
  try {
    const all = readQuizMap(base);
    all.delete(quizId);
    if (value !== null) all.set(quizId, value);
    const kept = [...all.entries()].slice(-QUIZ_CARDS_SENT_MAX_QUIZZES);
    localStorage.setItem(accountStorageKey(base), JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Sem storage: so vale nesta sessao.
  }
}

// Ultima resposta errada de cada pergunta (area de erradas), so neste dispositivo.
export type LastWrongAnswers = ReadonlyMap<string, QuizResponse>;

function readLastWrong(quizId: string): Map<string, QuizResponse> {
  const raw = readQuizMap(ACCOUNT_SCOPED_KEYS.quizLastWrong).get(quizId);
  const out = new Map<string, QuizResponse>();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  Object.entries(raw).slice(0, SESSION_MAX_ITEMS).forEach(([id, value]) => {
    const response = parseStoredResponse(value);
    if (response) out.set(id, response);
  });
  return out;
}

export function useQuizLastWrong(quizId: string) {
  const [answers, setAnswers] = useState<Map<string, QuizResponse>>(() => readLastWrong(quizId));

  const save = useCallback(
    (next: Map<string, QuizResponse>) => {
      setAnswers(next);
      writeQuizMap(ACCOUNT_SCOPED_KEYS.quizLastWrong, quizId, next.size ? Object.fromEntries([...next].slice(-SESSION_MAX_ITEMS)) : null);
    },
    [quizId],
  );

  // Erradas guardam a resposta; certas saem da lista.
  const record = useCallback(
    (results: { id: string; response: QuizResponse; right: boolean }[]) => {
      const next = new Map(answers);
      results.forEach(({ id, response, right }) => {
        next.delete(id);
        if (!right) next.set(id, response);
      });
      save(next);
    },
    [answers, save],
  );

  const forget = useCallback(
    (ids: readonly string[] | 'all') => {
      if (ids === 'all') return save(new Map());
      const next = new Map(answers);
      ids.forEach((id) => next.delete(id));
      save(next);
    },
    [answers, save],
  );

  return { answers: answers as LastWrongAnswers, record, forget };
}

// Perguntas do ultimo exame (o proximo evita repeti-las), so neste dispositivo.
function readLastExam(quizId: string): string[] {
  const raw = readQuizMap(ACCOUNT_SCOPED_KEYS.quizLastExam).get(quizId);
  return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string').slice(0, SESSION_MAX_ITEMS) : [];
}

export function useQuizLastExam(quizId: string) {
  const [ids, setIds] = useState<string[]>(() => readLastExam(quizId));
  const remember = useCallback(
    (next: string[]) => {
      const kept = next.slice(0, SESSION_MAX_ITEMS);
      setIds(kept);
      writeQuizMap(ACCOUNT_SCOPED_KEYS.quizLastExam, quizId, kept);
    },
    [quizId],
  );
  return { ids, remember };
}

// Foco ligado ao quiz, so neste dispositivo: "nao perguntar mais" por quiz e a
// sessao de foco que a tentativa abriu (para a fechar no fim).
export function useQuizFocusPrefs(quizId: string) {
  const [optedOut, setOptedOutState] = useState<boolean>(() => readQuizMap(ACCOUNT_SCOPED_KEYS.quizFocusOptOut).get(quizId) === true);
  const [sessionId, setSessionIdState] = useState<string | null>(() => {
    const raw = readQuizMap(ACCOUNT_SCOPED_KEYS.quizFocusSession).get(quizId);
    return typeof raw === 'string' ? raw : null;
  });

  const setOptedOut = useCallback(
    (value: boolean) => {
      setOptedOutState(value);
      writeQuizMap(ACCOUNT_SCOPED_KEYS.quizFocusOptOut, quizId, value ? true : null);
    },
    [quizId],
  );
  const setSessionId = useCallback(
    (id: string | null) => {
      setSessionIdState(id);
      writeQuizMap(ACCOUNT_SCOPED_KEYS.quizFocusSession, quizId, id);
    },
    [quizId],
  );

  return { optedOut, setOptedOut, sessionId, setSessionId };
}
