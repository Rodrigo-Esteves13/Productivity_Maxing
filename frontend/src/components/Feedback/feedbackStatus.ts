import type { FeedbackItem } from '../../types/models';

// Estado mostrado de um feedback (admin e autor usam o mesmo): chave i18n.
type StatusKey = 'feedback.status.open' | 'feedback.status.replied' | 'feedback.status.done' | 'feedback.status.rejected';

export const FEEDBACK_STATUS_CLASS: Record<StatusKey, string> = {
  'feedback.status.open': 'border-violet-600 text-violet-300',
  'feedback.status.replied': 'border-sky-700 text-sky-300',
  'feedback.status.done': 'border-neutral-600 text-neutral-300',
  'feedback.status.rejected': 'border-red-800 text-red-300',
};

const RESOLUTION_KEY: Record<NonNullable<FeedbackItem['resolution']>, StatusKey> = {
  DONE: 'feedback.status.done',
  REJECTED: 'feedback.status.rejected',
};

export function feedbackStatusKey(
  item: Pick<FeedbackItem, 'isResolved' | 'resolution' | 'adminReply'>,
): StatusKey {
  if (item.resolution) return RESOLUTION_KEY[item.resolution];
  // Fechados antes de existir `resolution` contam como tratados.
  if (item.isResolved) return 'feedback.status.done';
  return item.adminReply ? 'feedback.status.replied' : 'feedback.status.open';
}
