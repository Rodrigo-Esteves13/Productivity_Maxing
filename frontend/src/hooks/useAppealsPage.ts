import { useCallback, useEffect, useRef, useState } from 'react';
import { getAppeals, resolveAppeal } from '../api/userService';
import type { Feedback } from '../components/UI/FeedbackBanner';
import type { AppealAdmin, AppealResolution, PaginatedAppeals } from '../types/models';
import { getHttpStatus, HTTP_CONFLICT } from '../lib/httpError';

const PAGE_SIZE = 10;
const FEEDBACK_MS = 4000;

const RESOLVED_MESSAGE: Record<AppealResolution, string> = {
  APPROVED: 'Appeal approved.',
  DENIED: 'Appeal denied.',
};

function insertAt<T>(list: T[], item: T, index: number): T[] {
  const copy = [...list];
  copy.splice(Math.min(index, copy.length), 0, item);
  return copy;
}

export function useAppealsPage() {
  const [appeals, setAppeals] = useState<AppealAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Espelhos do estado para ler o valor atual dentro de callbacks async
  // sem os recriar (e sem usar valores antigos de um render anterior).
  const appealsRef = useRef(appeals);
  const skipRef = useRef(skip);
  appealsRef.current = appeals;
  skipRef.current = skip;

  // Ids que a pessoa ja resolveu (pedido em curso ou concluido). TODA a
  // resposta do servidor passa por este filtro. Antes, um refetch que
  // chegava a meio de outra resolucao trazia de volta uma linha ja
  // removida, e os botoes Approve/Deny reapareciam ate ao refetch seguinte
  // (~1s depois). Em caso de falha o id sai daqui e a linha volta.
  const hiddenIdsRef = useRef(new Set<string>());
  const inFlightIdsRef = useRef(new Set<string>());
  // So a resposta do pedido MAIS RECENTE pode escrever no estado.
  const requestSeqRef = useRef(0);

  const applyPage = useCallback((data: PaginatedAppeals) => {
    const hidden = hiddenIdsRef.current;
    const visible = data.appeals.filter((appeal) => !hidden.has(appeal.id));
    setAppeals(visible);
    // O servidor ainda conta os que estao em curso; ja nao os mostramos.
    setTotal(Math.max(0, data.total - (data.appeals.length - visible.length)));
    setSkip(data.skip);
  }, []);

  const load = useCallback(
    async (skipTo: number, silent: boolean) => {
      const seq = ++requestSeqRef.current;
      try {
        if (!silent) {
          setIsLoading(true);
          setError('');
        }
        const data = await getAppeals({ status: 'pending', skip: skipTo, take: PAGE_SIZE });
        if (seq === requestSeqRef.current) applyPage(data);
      } catch {
        // Um refetch silencioso que falha deixa o que ja esta no ecra.
        if (!silent && seq === requestSeqRef.current) setError('Error loading appeals.');
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [applyPage],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  // Limpa-se sozinho para um "Appeal approved." nao ficar para sempre.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const goToNextPage = () => {
    if (skip + PAGE_SIZE >= total) return;
    void load(skip + PAGE_SIZE, false);
  };

  const goToPrevPage = () => {
    if (skip === 0) return;
    void load(Math.max(0, skip - PAGE_SIZE), false);
  };

  const handleResolve = useCallback(
    async (id: string, resolution: AppealResolution, resolutionNote?: string) => {
      const index = appealsRef.current.findIndex((appeal) => appeal.id === id);
      // Ja removido ou ja em curso (duplo clique): nada a fazer.
      if (index === -1 || inFlightIdsRef.current.has(id)) return;

      const removed = appealsRef.current[index];
      const remainingOnPage = appealsRef.current.length - 1;
      inFlightIdsRef.current.add(id);
      hiddenIdsRef.current.add(id);

      // Remocao otimista: a linha sai no mesmo render do clique, sem
      // esperar pelo servidor.
      setFeedback(null);
      setAppeals((prev) => prev.filter((appeal) => appeal.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));

      try {
        await resolveAppeal(id, resolution, resolutionNote);
        setFeedback({ type: 'success', message: RESOLVED_MESSAGE[resolution] });
      } catch (caught) {
        if (getHttpStatus(caught) !== HTTP_CONFLICT) {
          // Falhou mesmo: a linha volta ao sitio onde estava, so ela.
          hiddenIdsRef.current.delete(id);
          setAppeals((prev) =>
            prev.some((appeal) => appeal.id === id) ? prev : insertAt(prev, removed, index),
          );
          setTotal((prev) => prev + 1);
          setFeedback({ type: 'error', message: 'Could not resolve this appeal. Please try again.' });
          return;
        }
        // 409: outra pessoa ja a resolveu. Continua escondida.
        setFeedback({ type: 'error', message: 'This appeal was already resolved by someone else.' });
      } finally {
        inFlightIdsRef.current.delete(id);
      }

      // A pagina pode ter ficado com menos de PAGE_SIZE itens enquanto ha
      // mais na seguinte (ou vazia, se era o ultimo): reconcilia em
      // background, sem piscar a pagina.
      const currentSkip = skipRef.current;
      const skipTo =
        remainingOnPage === 0 && currentSkip > 0 ? Math.max(0, currentSkip - PAGE_SIZE) : currentSkip;
      void load(skipTo, true);
    },
    [load],
  );

  return {
    appeals,
    total,
    skip,
    pageSize: PAGE_SIZE,
    isLoading,
    error,
    feedback,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  };
}
