import { useCallback, useEffect, useState } from 'react';
import { getAppeals, resolveAppeal } from '../api/userService';
import type { AppealAdmin, AppealResolution } from '../types/models';

const PAGE_SIZE = 10;

export function useAppealsPage() {
  const [appeals, setAppeals] = useState<AppealAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [skip, setSkip] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchAppeals(0);
  }, [fetchAppeals]);

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
    setResolvingId(id);
    try {
      await resolveAppeal(id, resolution, resolutionNote);
      // Reconsulta a mesma página em vez de tirar o item da lista local -
      // uma vez resolvido deixa de contar como "pending", o que muda o
      // `total` e pode trazer para esta página um item que estava na
      // seguinte. Um filter local deixaria a paginação dessincronizada.
      const stillHasItemsHere = appeals.length > 1 || skip === 0;
      await fetchAppeals(stillHasItemsHere ? skip : Math.max(0, skip - PAGE_SIZE));
    } finally {
      setResolvingId(null);
    }
  };

  return {
    appeals,
    total,
    skip,
    pageSize: PAGE_SIZE,
    isLoading,
    error,
    resolvingId,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  };
}
