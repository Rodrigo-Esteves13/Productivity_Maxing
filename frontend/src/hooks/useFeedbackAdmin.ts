import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getFeedbackList,
  rejectFeedback,
  replyToFeedback,
  setFeedbackMuted,
  setFeedbackResolved,
} from '../api/feedbackService';
import { banUser, reactivateUser, suspendUser } from '../api/userService';
import type { FeedbackAuthor, FeedbackItem, UserStatus } from '../types/models';
import { translateNow } from '../i18n/translate';
import { useFeedback } from '../context/useFeedback';

export type FeedbackFilter = 'open' | 'closed' | 'all';

const FILTER_MATCH: Record<FeedbackFilter, (item: FeedbackItem) => boolean> = {
  open: (item) => !item.isResolved,
  closed: (item) => item.isResolved,
  all: () => true,
};

export type AccountAction = 'ban' | 'suspend';

// Dados e acoes da pagina de feedback (admin). As acoes devolvem true quando
// correram bem, para o item fechar o formulario.
export function useFeedbackAdmin() {
  const { notify } = useFeedback();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FeedbackFilter>('open');

  useEffect(() => {
    getFeedbackList()
      .then(setItems)
      .catch(() => setError(translateNow('ui.errorLoadingFeedback')))
      .finally(() => setIsLoading(false));
  }, []);

  const replaceItem = useCallback((updated: FeedbackItem) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }, []);

  // O mesmo autor pode ter varios feedbacks: muda-os todos.
  const patchAuthor = useCallback((userId: string, patch: Partial<FeedbackAuthor>) => {
    setItems((prev) =>
      prev.map((i) => (i.user?.id === userId ? { ...i, user: { ...i.user, ...patch } } : i)),
    );
  }, []);

  const run = useCallback(
    async (action: () => Promise<void>, successKey: string): Promise<boolean> => {
      try {
        await action();
        notify(translateNow(successKey), 'success');
        return true;
      } catch {
        notify(translateNow('feedback.admin.actionError'), 'error');
        return false;
      }
    },
    [notify],
  );

  const toggleResolved = useCallback(
    (item: FeedbackItem) =>
      run(
        async () => replaceItem(await setFeedbackResolved(item.id, !item.isResolved)),
        item.isResolved ? 'feedback.admin.reopened' : 'feedback.admin.resolved',
      ),
    [run, replaceItem],
  );

  const reply = useCallback(
    (id: string, message: string, resolve: boolean) =>
      run(async () => replaceItem(await replyToFeedback(id, { message, resolve })), 'feedback.admin.replySent'),
    [run, replaceItem],
  );

  const reject = useCallback(
    (id: string, reason: string) =>
      run(async () => replaceItem(await rejectFeedback(id, reason || undefined)), 'feedback.admin.declined'),
    [run, replaceItem],
  );

  const toggleMuted = useCallback(
    (author: FeedbackAuthor) => {
      const muted = !author.feedbackMutedAt;
      return run(async () => {
        await setFeedbackMuted(author.id, muted);
        patchAuthor(author.id, { feedbackMutedAt: muted ? new Date().toISOString() : null });
      }, muted ? 'feedback.admin.mutedDone' : 'feedback.admin.unmutedDone');
    },
    [run, patchAuthor],
  );

  const applyAccountAction = useCallback(
    (author: FeedbackAuthor, action: AccountAction, payload: { reason: string; until?: string }) =>
      run(async () => {
        const updated =
          action === 'ban'
            ? await banUser(author.id, payload.reason)
            : await suspendUser(author.id, { reason: payload.reason, until: payload.until ?? '' });
        patchAuthor(author.id, { status: updated.status ?? (action === 'ban' ? 'BANNED' : 'SUSPENDED') });
      }, action === 'ban' ? 'feedback.admin.bannedDone' : 'feedback.admin.suspendedDone'),
    [run, patchAuthor],
  );

  const reactivate = useCallback(
    (author: FeedbackAuthor) =>
      run(async () => {
        const updated = await reactivateUser(author.id);
        patchAuthor(author.id, { status: updated.status ?? ('ACTIVE' as UserStatus) });
      }, 'feedback.admin.reactivatedDone'),
    [run, patchAuthor],
  );

  const counts = useMemo(
    () => ({
      open: items.filter(FILTER_MATCH.open).length,
      closed: items.filter(FILTER_MATCH.closed).length,
      all: items.length,
    }),
    [items],
  );

  const visible = useMemo(() => items.filter(FILTER_MATCH[filter]), [items, filter]);

  return {
    items,
    visible,
    counts,
    filter,
    setFilter,
    isLoading,
    error,
    toggleResolved,
    reply,
    reject,
    toggleMuted,
    applyAccountAction,
    reactivate,
  };
}
