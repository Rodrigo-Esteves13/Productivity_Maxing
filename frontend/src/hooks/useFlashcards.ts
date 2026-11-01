import { useCallback, useEffect, useState } from 'react';
import {
  createFlashcard,
  deleteFlashcard,
  getFlashcards,
  reviewFlashcard,
  updateFlashcard,
  type FlashcardInput,
} from '../api/flashcardsService';
import type { Flashcard, FlashcardGrade } from '../types/models';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';

// Cartoes de revisao espacada. As acoes devolvem true quando correram bem;
// erros viram um toast.
export function useFlashcards() {
  const { notify } = useFeedback();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setError(false);
    setIsLoading(true);
    getFlashcards()
      .then(setCards)
      .catch(() => setError(true))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  const run = useCallback(
    async (action: () => Promise<void>): Promise<boolean> => {
      try {
        await action();
        return true;
      } catch {
        notify(translateNow('flashcards.saveError'), 'error');
        return false;
      }
    },
    [notify],
  );

  const replace = (card: Flashcard) => setCards((prev) => prev.map((c) => (c.id === card.id ? card : c)));

  const create = (input: FlashcardInput) =>
    run(async () => {
      const card = await createFlashcard(input);
      setCards((prev) => [...prev, card]);
    });

  const update = (id: string, input: FlashcardInput) => run(async () => replace(await updateFlashcard(id, input)));

  const remove = (id: string) =>
    run(async () => {
      await deleteFlashcard(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
    });

  const review = (id: string, grade: FlashcardGrade) => run(async () => replace(await reviewFlashcard(id, grade)));

  return { cards, isLoading, error, reload: load, create, update, remove, review };
}
