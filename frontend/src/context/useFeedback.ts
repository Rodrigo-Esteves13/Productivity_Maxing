import { useContext } from 'react';
import { FeedbackContext, type FeedbackContextValue } from './feedback-context';

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) {
    throw new Error('useFeedback must be used inside <FeedbackProvider>.');
  }
  return value;
}
