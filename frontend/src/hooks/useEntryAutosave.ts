import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotebookEntrySavePayload } from '../components/Notebook/entry/entryTypes';
import { describeSaveError } from '../components/Notebook/entry/notebookEntryConfig';
import { getHttpStatus } from '../lib/httpError';

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

// Tempo sem mexer antes de gravar sozinho.
const AUTOSAVE_DELAY_MS = 1500;

interface UseEntryAutosaveOptions {
  // So grava em modo edicao.
  enabled: boolean;
  // Tem de ser memoizado (useMemo): o efeito reage a mudancas da referencia.
  payload: NotebookEntrySavePayload;
  // Impede gravar (ex.: texto acima do limite do backend).
  blocked: boolean;
  textLength: number;
  onSave: (payload: NotebookEntrySavePayload) => Promise<void>;
}

// Auto save do Notebook. Compara o payload serializado com o ultimo que foi
// gravado (baseline), por isso so vai ao servidor quando algo mudou mesmo.
// O JSON.stringify so corre quando o temporizador dispara - nunca por cada
// movimento da caneta no quadro.
export function useEntryAutosave({ enabled, payload, blocked, textLength, onSave }: UseEntryAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');

  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  const textLengthRef = useRef(textLength);
  textLengthRef.current = textLength;
  const savedAtRef = useRef<Date | null>(null);

  // null = ainda nao ha baseline (fora de edicao, ou 1a render em edicao).
  const baselineRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    if (baselineRef.current === null) return true;
    if (inFlightRef.current) {
      await inFlightRef.current;
      return flush();
    }

    const current = payloadRef.current;
    const serialized = JSON.stringify(current);
    if (serialized === baselineRef.current) {
      setStatus((s) => (s === 'pending' ? (savedAtRef.current ? 'saved' : 'idle') : s));
      return true;
    }
    if (blockedRef.current) {
      setStatus('error');
      setError(describeSaveError(400, textLengthRef.current));
      return false;
    }

    setStatus('saving');
    setError('');
    const run = (async () => {
      try {
        await onSaveRef.current(current);
        baselineRef.current = serialized;
        const now = new Date();
        savedAtRef.current = now;
        setSavedAt(now);
        setStatus('saved');
        return true;
      } catch (err) {
        setError(describeSaveError(getHttpStatus(err), textLengthRef.current));
        setStatus('error');
        return false;
      } finally {
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = run;
    const ok = await run;
    // Se o utilizador escreveu enquanto gravava, grava o resto ja.
    if (ok && JSON.stringify(payloadRef.current) !== baselineRef.current) return flush();
    return ok;
  }, []);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null;
      setStatus('idle');
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (baselineRef.current === null) {
      baselineRef.current = JSON.stringify(payload);
      return;
    }
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    const timer = setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, payload]);

  // Trocar de entrada / sair da pagina: grava o que ficou pendente.
  useEffect(() => () => void flushRef.current(), []);

  // Aviso do browser so se houver mesmo algo por gravar.
  const hasUnsaved = status === 'pending' || status === 'saving' || status === 'error';
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  return { status, savedAt, error, flush };
}
