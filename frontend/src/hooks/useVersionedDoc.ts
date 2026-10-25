import { useCallback, useEffect, useRef, useState } from 'react';
import { HTTP_CONFLICT, getHttpStatus } from '../lib/httpError';

const HTTP_FORBIDDEN = 403;
import { useLiveRefresh } from './useLiveRefresh';

// Texto editado por varias pessoas (Pad, nota da turma) com concorrencia
// otimista: grava sobre a versao carregada; se alguem gravou antes, o
// backend responde 409 com a versao atual e o utilizador escolhe.
export type VersionedDocStatus = 'loading' | 'saved' | 'dirty' | 'saving' | 'conflict' | 'error';

export interface VersionedSnapshot<D> {
  doc: D;
  version: number;
}

interface UseVersionedDocOptions<D> {
  // Muda quando o documento aberto muda (ex: outro slug): recarrega tudo.
  key: string;
  load: () => Promise<VersionedSnapshot<D>>;
  save: (doc: D, baseVersion: number) => Promise<VersionedSnapshot<D>>;
  // Extrai a versao atual do corpo de um 409.
  parseConflict: (body: unknown) => VersionedSnapshot<D> | null;
  enabled?: boolean;
  // 403 ao gravar: perdeu a permissao (pad trancado por outra conta, nota
  // da turma fechada pelo delegado). Quem chama recarrega as permissoes para
  // o editor passar a so leitura em vez de "continua a escrever".
  onForbidden?: () => void;
}

export const VERSIONED_SAVE_DEBOUNCE_MS = 800;
export const VERSIONED_POLL_MS = 3000;

function conflictBody(error: unknown): unknown {
  return (error as { response?: { data?: unknown } } | null)?.response?.data;
}

export function useVersionedDoc<D>({ key, load, save, parseConflict, enabled = true, onForbidden }: UseVersionedDocOptions<D>) {
  const [doc, setDoc] = useState<D | null>(null);
  const [status, setStatus] = useState<VersionedDocStatus>('loading');
  const [remote, setRemote] = useState<VersionedSnapshot<D> | null>(null);

  // Refs para os timers e respostas lerem sempre o estado mais recente.
  const docRef = useRef<D | null>(null);
  const versionRef = useRef(0);
  const statusRef = useRef<VersionedDocStatus>('loading');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fns = useRef({ load, save, parseConflict });
  const onForbiddenRef = useRef(onForbidden);
  onForbiddenRef.current = onForbidden;
  // Definido mais abaixo; em ref para o cleanup do load o poder chamar.
  const flushOnLeaveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    fns.current = { load, save, parseConflict };
  }, [load, save, parseConflict]);

  const setStatusBoth = useCallback((next: VersionedDocStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const apply = useCallback(
    (snapshot: VersionedSnapshot<D>) => {
      docRef.current = snapshot.doc;
      versionRef.current = snapshot.version;
      setDoc(snapshot.doc);
      setRemote(null);
      setStatusBoth('saved');
    },
    [setStatusBoth],
  );

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    setStatusBoth('loading');
    fns.current
      .load()
      .then((snapshot) => {
        if (!cancelled) apply(snapshot);
      })
      .catch(() => {
        if (!cancelled) setStatusBoth('error');
      });
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      // Sair (ou trocar de documento) com texto por gravar: grava ja, sem
      // esperar pelo debounce. Antes os ultimos 800 ms (ou um erro por
      // repetir) perdiam-se sem aviso.
      flushOnLeaveRef.current();
    };
  }, [key, enabled, apply, setStatusBoth]);

  const flush = useCallback(
    async (baseVersion = versionRef.current) => {
      const draft = docRef.current;
      if (draft === null) return;
      setStatusBoth('saving');
      try {
        const saved = await fns.current.save(draft, baseVersion);
        versionRef.current = saved.version;
        // Se o utilizador escreveu durante o pedido, fica por gravar.
        if (docRef.current === draft) setStatusBoth('saved');
        else setStatusBoth('dirty');
      } catch (error) {
        const current = getHttpStatus(error) === HTTP_CONFLICT ? fns.current.parseConflict(conflictBody(error)) : null;
        if (current) {
          setRemote(current);
          setStatusBoth('conflict');
        } else {
          setStatusBoth('error');
          if (getHttpStatus(error) === HTTP_FORBIDDEN) onForbiddenRef.current?.();
        }
      }
    },
    [setStatusBoth],
  );

  // Grava depois de uma pausa na escrita; com conflito aberto nao grava nada.
  useEffect(() => {
    if (status !== 'dirty') return undefined;
    timerRef.current = setTimeout(() => void flush(), VERSIONED_SAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [status, doc, flush]);

  const change = useCallback(
    (next: D) => {
      docRef.current = next;
      setDoc(next);
      // Durante um pedido, o fim do flush ve que mudou e marca 'dirty'; marcar
      // ja agendava um segundo pedido com a versao antiga (409 consigo mesmo).
      if (statusRef.current !== 'conflict' && statusRef.current !== 'saving') setStatusBoth('dirty');
    },
    [setStatusBoth],
  );

  // Gravacao "dispara e esquece" ao sair: o componente pode ja nao existir,
  // por isso nao mexe em estado. Conflito fica de fora (gravar seria por
  // cima da versao dos outros sem o utilizador escolher).
  flushOnLeaveRef.current = () => {
    const draft = docRef.current;
    if (draft === null || (statusRef.current !== 'dirty' && statusRef.current !== 'error')) return;
    fns.current.save(draft, versionRef.current).catch(() => undefined);
  };

  // Fechar o separador / app em segundo plano (pagehide cobre o iOS, onde o
  // beforeunload nao corre): grava o pendente e avisa se ainda ha algo.
  const hasUnsaved = status === 'dirty' || status === 'saving' || status === 'error' || status === 'conflict';
  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const onPageHide = () => flushOnLeaveRef.current();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [hasUnsaved]);

  // Polling: so traz alteracoes de outros quando nao ha nada por gravar aqui.
  const refresh = useCallback(() => {
    if (statusRef.current !== 'saved') return;
    fns.current
      .load()
      .then((snapshot) => {
        if (statusRef.current === 'saved' && snapshot.version !== versionRef.current) apply(snapshot);
      })
      .catch(() => undefined);
  }, [apply]);
  useLiveRefresh(refresh, { enabled: enabled && status === 'saved', intervalMs: VERSIONED_POLL_MS });

  // Conflito: ficar com a versao dos outros, ou gravar a minha por cima.
  const takeRemote = useCallback(() => {
    if (remote) apply(remote);
  }, [remote, apply]);
  const keepMine = useCallback(() => {
    if (!remote) return;
    setRemote(null);
    void flush(remote.version);
  }, [remote, flush]);

  return { doc, status, remote, change, takeRemote, keepMine, retry: () => void flush() };
}
