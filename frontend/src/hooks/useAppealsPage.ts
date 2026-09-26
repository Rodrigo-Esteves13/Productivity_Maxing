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
  const [resolvingId, setResolvingId] = useState<string | null>(null);
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
    setResolvingId(id);
    setFeedback(null);
    try {
      await resolveAppeal(id, resolution, resolutionNote);

      // Instant feedback: drop it from the list and the count right away
      // instead of waiting on a refetch - the mutation already succeeded,
      // there's nothing left to wait for from the user's point of view.
      setAppeals((prev) => prev.filter((a) => a.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      setFeedback({
        type: 'success',
        message: resolution === 'APPROVED' ? 'Appeal approved.' : 'Appeal denied.',
      });

      // The optimistic update above can leave this page with one fewer
      // item than PAGE_SIZE while a later page still has more (or leave
      // an empty page if this was the last item here) - reconcile against
      // the server in the background so pagination stays correct without
      // undoing the instant feedback above.
      const wasLastItemOnPage = appeals.length <= 1 && skip > 0;
      reconcileSilently(wasLastItemOnPage ? Math.max(0, skip - PAGE_SIZE) : skip);
    } catch {
      setFeedback({ type: 'error', message: 'Could not resolve this appeal. Please try again.' });
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
    feedback,
    goToNextPage,
    goToPrevPage,
    handleResolve,
  };
}
