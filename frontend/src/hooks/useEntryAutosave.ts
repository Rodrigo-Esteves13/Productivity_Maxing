import { useCallback, useEffect, useRef, useState } from 'react';
import type { NotebookEntrySavePayload } from '../components/Notebook/entry/entryTypes';
import { describeSaveError } from '../components/Notebook/entry/notebookEntryConfig';
import { getHttpStatus } from '../lib/httpError';
import { EntryConflictError } from '../lib/notebookEntryConflict';
import type { NotebookEntry } from '../types/models';

// 'conflict' = alguem gravou a entrada depois de ela abrir aqui; nada e
// gravado ate o utilizador escolher (ver EntryConflictBanner).
export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

// Tempo sem mexer antes de gravar sozinho.
const AUTOSAVE_DELAY_MS = 1500;

interface UseEntryAutosaveOptions {
  // So grava em modo edicao.
  enabled: boolean;
  // false = o utilizador desligou o auto save: so grava com Ctrl+S, "Done"
  // ou ao sair da entrada (rede de seguranca contra perder o que escreveu).
  auto: boolean;
  // Tem de ser memoizado (useMemo): o efeito reage a mudancas da referencia.
  payload: NotebookEntrySavePayload;
  // Impede gravar (ex.: texto acima do limite do backend).
  blocked: boolean;
  textLength: number;
  onSave: (payload: NotebookEntrySavePayload) => Promise<void>;
  // A gravacao ao sair da entrada falhou: o editor ja desmontou, por isso
  // quem chama guarda a copia e avisa fora do editor.
  onLeaveSaveFailed?: (payload: NotebookEntrySavePayload) => void;
}

// Auto save do Notebook. Compara o payload serializado com o ultimo que foi
// gravado (baseline), por isso so vai ao servidor quando algo mudou mesmo.
// O JSON.stringify so corre quando o temporizador dispara - nunca por cada
// movimento da caneta no quadro.
export function useEntryAutosave({
  enabled,
  auto,
  payload,
  blocked,
  textLength,
  onSave,
  onLeaveSaveFailed,
}: UseEntryAutosaveOptions) {
  const [status, setStatusState] = useState<AutosaveStatus>('idle');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState('');
  // Versao atual do servidor quando ha conflito.
  const [conflict, setConflict] = useState<NotebookEntry | null>(null);
  const statusRef = useRef<AutosaveStatus>('idle');
  const setStatus = useCallback((next: AutosaveStatus | ((prev: AutosaveStatus) => AutosaveStatus)) => {
    setStatusState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      statusRef.current = value;
      return value;
    });
  }, []);
  const onLeaveSaveFailedRef = useRef(onLeaveSaveFailed);
  onLeaveSaveFailedRef.current = onLeaveSaveFailed;

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
        if (err instanceof EntryConflictError) {
          setConflict(err.current);
          setStatus('conflict');
          return false;
        }
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
  }, [setStatus]);

  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => {
    if (!enabled) {
      baselineRef.current = null;
      setStatus('idle');
    }
  }, [enabled, setStatus]);

  useEffect(() => {
    if (!enabled) return;
    if (baselineRef.current === null) {
      baselineRef.current = JSON.stringify(payload);
      return;
    }
    // Com conflito aberto nada grava sozinho (seria outro 409): espera pela escolha.
    if (statusRef.current === 'conflict') return;
    setStatus((s) => (s === 'saving' ? s : 'pending'));
    if (!auto) return;
    const timer = setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [enabled, auto, payload, setStatus]);

  // Trocar de entrada / sair da pagina: grava o que ficou pendente. Se falhar
  // (rede, 5xx, conflito) o erro ja nao tem onde aparecer: entrega a copia a
  // quem chama em vez de a deitar fora.
  useEffect(
    () => () => {
      const leftWith = payloadRef.current;
      void flushRef.current().then((ok) => {
        if (!ok) onLeaveSaveFailedRef.current?.(leftWith);
      });
    },
    [],
  );

  // Conflito: "manter a minha" grava por cima da versao atual (quem chama
  // ja pos essa versao como base); "usar a outra" larga o rascunho.
  const keepMine = useCallback(async (): Promise<boolean> => {
    setConflict(null);
    setStatus('pending');
    return flush();
  }, [flush, setStatus]);
  const discard = useCallback(() => {
    baselineRef.current = null;
    setConflict(null);
    setStatus('idle');
  }, [setStatus]);

  // Aviso do browser so se houver mesmo algo por gravar.
  const hasUnsaved = status === 'pending' || status === 'saving' || status === 'error' || status === 'conflict';
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  return { status, savedAt, error, conflict, flush, keepMine, discard };
}
