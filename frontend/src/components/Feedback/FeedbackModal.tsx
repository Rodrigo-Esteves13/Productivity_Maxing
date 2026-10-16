import { useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import Modal from '../UI/Modal';
import { sendFeedback } from '../../api/feedbackService';
import { useI18n } from '../../i18n/useI18n';
import { useFeedback } from '../../context/useFeedback';
import type { FeedbackCategory } from '../../types/models';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { value: FeedbackCategory; key: string }[] = [
  { value: 'BUG', key: 'feedback.category.bug' },
  { value: 'IDEA', key: 'feedback.category.idea' },
  { value: 'TRANSLATION', key: 'feedback.category.translation' },
  { value: 'CONFUSING', key: 'feedback.category.confusing' },
  { value: 'OTHER', key: 'feedback.category.other' },
];

// Feedback em qualquer língua (o texto livre nunca é restringido a um
// alfabeto). A língua da app e a página seguem junto para o admin ter contexto.
export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { t, lang } = useI18n();
  const { notify } = useFeedback();
  const { pathname } = useLocation();
  const [category, setCategory] = useState<FeedbackCategory>('OTHER');
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim().length < 3) {
      setError(t('feedback.tooShort'));
      return;
    }
    setIsSending(true);
    setError('');
    try {
      await sendFeedback({
        category,
        rating: rating ?? undefined,
        message: message.trim(),
        language: lang,
        page: pathname,
      });
      notify(t('feedback.thanks'), 'success');
      setMessage('');
      setRating(null);
      setCategory('OTHER');
      onClose();
    } catch {
      setError(t('feedback.error'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('feedback.title')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <p className="text-sm text-neutral-400">{t('feedback.intro')}</p>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-neutral-300">{t('feedback.category')}</legend>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-pressed={category === c.value}
                onClick={() => setCategory(c.value)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === c.value
                    ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {t(c.key)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-neutral-300">{t('feedback.rating')}</legend>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={rating === n}
                aria-label={`${n}/5`}
                onClick={() => setRating(rating === n ? null : n)}
                className={`h-9 w-9 rounded-lg border text-sm transition-colors ${
                  rating === n
                    ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                    : 'border-neutral-700 text-neutral-400 hover:border-neutral-500'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-xs font-medium text-neutral-300">
          {t('feedback.message')}
          <textarea
            value={message}
            maxLength={2000}
            rows={5}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('feedback.placeholder')}
            className="mt-1.5 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800"
          >
            {t('feedback.cancel')}
          </button>
          <button
            type="submit"
            disabled={isSending}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {isSending ? t('feedback.sending') : t('feedback.send')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
