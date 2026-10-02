import { useCallback, useEffect, useState } from 'react';
import { getAppeals, resolveAppeal } from '../api/userService';
import type { AppealAdmin, AppealResolution } from '../types/models';

const PAGE_SIZE = 10;

interface Feedback {
  type: 'success' | 'error';
  message: string;
}

export function useAppealsPage() {
  const [appeals, setAppeals] = useState<AppealAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const fetchAppeals = useCallback(async (skipOverride = 0) => {
    try {
      setIsLoading(true);
      setError('');
      const data = await getAppeals({ status: 'pending', skip: skipOverride, take: PAGE_SIZE });
      setAppeals(data.appeals);
      setTotal(data.total);
      setSkip(data.skip);
    } catch {
      setError('Error loading appeals.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Same request as fetchAppeals, but without the loading flag - used
  // after a resolve, where the list already shows the (optimistically
  // updated) right thing and a full-page skeleton flash would just make
  // an already-applied action feel like it's redoing work. Failures are
  // ignored: the mutation itself already succeeded, this is just
  // reconciling pagination in the background (see handleResolve).
  const reconcileSilently = useCallback(async (skipOverride: number) => {
    try {
      const data = await getAppeals({ status: 'pending', skip: skipOverride, take: PAGE_SIZE });
      setAppeals(data.appeals);
      setTotal(data.total);
      setSkip(data.skip);
    } catch {
      // ignore - what's already on screen (from the optimistic update)
      // stays put
    }
  }, []);

  useEffect(() => {
    fetchAppeals(0);
  }, [fetchAppeals]);

  // Clears itself so a stale "Appeal approved." doesn't linger forever.
  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const goToNextPage = () => {
    if (skip + PAGE_SIZE >= total) return;
    fetchAppeals(skip + PAGE_SIZE);
  };

  const goToPrevPage = () => {
    if (skip === 0) return;
    fetchAppeals(Math.max(0, skip - PAGE_SIZE));
  };

  const handleResolve = async (
    id: string,
    resolution: AppealResolution,
    resolutionNote?: string,
  ) => {
    // Remoção OTIMISTA: o appeal sai da lista no mesmo render do clique.
    // Antes, a linha só desaparecia depois da resposta do servidor, e
    // durante esse segundo os botões Approve/Deny voltavam a aparecer
    // (ver AppealRow). Guardamos o estado anterior para repor se o pedido
    // falhar, em vez de deixar o admin a achar que resolveu algo que não
    // resolveu.
    const previousAppeals = appeals;
    const previousTotal = total;
    const wasLastItemOnPage = appeals.length <= 1 && skip > 0;

    setFeedback(null);
    setAppeals((prev) => prev.filter((a) => a.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));

    try {
      await resolveAppeal(id, resolution, resolutionNote);
      setFeedback({
        type: 'success',
        message: resolution === 'APPROVED' ? 'Appeal approved.' : 'Appeal denied.',
      });

      // A remoção pode deixar esta página com menos de PAGE_SIZE itens
      // enquanto há mais na seguinte (ou vazia, se era o último): reconcilia
      // com o servidor em background, sem piscar a página.
      void reconcileSilently(wasLastItemOnPage ? Math.max(0, skip - PAGE_SIZE) : skip);
    } catch {
      setAppeals(previousAppeals);
      setTotal(previousTotal);
      setFeedback({ type: 'error', message: 'Could not resolve this appeal. Please try again.' });
    }
  };

  return {
    appeals,
    total,
    skip,
    pageSize: PAGE_SIZE,
    isLoading,
    error,
    resolvingId: null as string | null,
    feedback,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  };
}
