import { useCallback, useEffect, useState } from 'react';
import {
  FEEDBACK_PAGE_SIZE,
  getFeedbackPage,
  rejectFeedback,
  replyToFeedback,
  setFeedbackMuted,
  setFeedbackResolved,
  type FeedbackFilter,
} from '../api/feedbackService';
import { banUser, reactivateUser, suspendUser } from '../api/userService';
import type { FeedbackAuthor, FeedbackCategory } from '../types/models';
import { ALL_FILTER, type AllOr } from '../lib/adminLists';
import { translateNow } from '../i18n/translate';
import { useFeedback } from '../context/useFeedback';
import { useDebouncedValue } from './useDebouncedValue';
import { useFetch } from './useFetch';

export type AccountAction = 'ban' | 'suspend';

const SEARCH_DEBOUNCE_MS = 300;

export interface FeedbackAdminFilters {
  status: FeedbackFilter;
  query: string;
  category: AllOr<FeedbackCategory>;
  language: string;
}

const INITIAL_FILTERS: FeedbackAdminFilters = {
  status: 'open',
  query: '',
  category: ALL_FILTER,
  language: ALL_FILTER,
};

// Dados e acoes da pagina de feedback (admin). Filtros, pesquisa e paginas sao
// do servidor. As acoes devolvem true quando correram bem, para o item fechar o
// formulario; a seguir a pagina volta a ser pedida.
export function useFeedbackAdmin() {
  const { notify } = useFeedback();
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [skip, setSkip] = useState(0);
  const search = useDebouncedValue(filters.query.trim(), SEARCH_DEBOUNCE_MS);
  const { status, category, language } = filters;

  const fetcher = useCallback(
    (signal: AbortSignal) =>
      getFeedbackPage(
        {
          status,
          skip,
          take: FEEDBACK_PAGE_SIZE,
          ...(search ? { q: search } : {}),
          ...(category !== ALL_FILTER ? { category } : {}),
          ...(language !== ALL_FILTER ? { language } : {}),
        },
        signal,
      ),
    [status, category, language, search, skip],
  );
  const { data, isLoading, hasError, reload } = useFetch(fetcher);

  // Mudar um filtro volta sempre a primeira pagina.
  const updateFilters = useCallback((patch: Partial<FeedbackAdminFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setSkip(0);
  }, []);

  // A ultima pagina ficou vazia (o unico item mudou de estado): recua.
  useEffect(() => {
    if (data && data.items.length === 0 && data.total > 0 && skip >= data.total) {
      setSkip(Math.max(0, skip - FEEDBACK_PAGE_SIZE));
    }
  }, [data, skip]);

  const run = useCallback(
    async (action: () => Promise<unknown>, successKey: string): Promise<boolean> => {
      try {
        await action();
        notify(translateNow(successKey), 'success');
        await reload();
        return true;
      } catch {
        notify(translateNow('feedback.admin.actionError'), 'error');
        return false;
      }
    },
    [notify, reload],
  );

  const toggleResolved = useCallback(
    (item: { id: string; isResolved: boolean }) =>
      run(
        () => setFeedbackResolved(item.id, !item.isResolved),
        item.isResolved ? 'feedback.admin.reopened' : 'feedback.admin.resolved',
      ),
    [run],
  );

  const reply = useCallback(
    (id: string, message: string, resolve: boolean) =>
      run(() => replyToFeedback(id, { message, resolve }), 'feedback.admin.replySent'),
    [run],
  );

  const reject = useCallback(
    (id: string, reason: string) =>
      run(() => rejectFeedback(id, reason || undefined), 'feedback.admin.declined'),
    [run],
  );

  const toggleMuted = useCallback(
    (author: FeedbackAuthor) => {
      const muted = !author.feedbackMutedAt;
      return run(
        () => setFeedbackMuted(author.id, muted),
        muted ? 'feedback.admin.mutedDone' : 'feedback.admin.unmutedDone',
      );
    },
    [run],
  );

  const applyAccountAction = useCallback(
    (author: FeedbackAuthor, action: AccountAction, payload: { reason: string; until?: string }) =>
      run(
        () =>
          action === 'ban'
            ? banUser(author.id, payload.reason)
            : suspendUser(author.id, { reason: payload.reason, until: payload.until ?? '' }),
        action === 'ban' ? 'feedback.admin.bannedDone' : 'feedback.admin.suspendedDone',
      ),
    [run],
  );

  const reactivate = useCallback(
    (author: FeedbackAuthor) => run(() => reactivateUser(author.id), 'feedback.admin.reactivatedDone'),
    [run],
  );

  return {
    page: data,
    filters,
    updateFilters,
    // A pesquisa que ja foi ao servidor (para a mensagem de "sem resultados").
    search,
    skip,
    pageSize: FEEDBACK_PAGE_SIZE,
    goToNextPage: () => setSkip((prev) => prev + FEEDBACK_PAGE_SIZE),
    goToPrevPage: () => setSkip((prev) => Math.max(0, prev - FEEDBACK_PAGE_SIZE)),
    isLoading,
    hasError,
    reload,
    toggleResolved,
    reply,
    reject,
    toggleMuted,
    applyAccountAction,
    reactivate,
  };
}
