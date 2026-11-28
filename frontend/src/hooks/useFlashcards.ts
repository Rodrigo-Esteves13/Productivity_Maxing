import { useCallback, useEffect, useState } from 'react';
import {
  createFlashcard,
  createFlashcards,
  deleteFlashcard,
  getFlashcards,
  restoreFlashcard,
  reviewFlashcard,
  updateFlashcard,
  type FlashcardInput,
  type FlashcardSchedule,
} from '../api/flashcardsService';
import type { Flashcard, FlashcardGrade } from '../types/models';
import { chunkCards, withReverseCards } from '../lib/flashcardImport';
import { useFeedback } from '../context/useFeedback';
import { translateNow } from '../i18n/translate';
import { useUndoableDelete } from './useUndoableDelete';
import { settleInBatches } from '../lib/batch';

// Cartoes de revisao espacada. As acoes devolvem true quando correram bem;
// erros viram um toast.
export function useFlashcards() {
  const { notify } = useFeedback();
  const offerUndoDelete = useUndoableDelete();
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

  // `reverse`: cria tambem o cartao com frente e verso trocados (o que nao
  // couber ou ja existir e ignorado e avisado). Os dois vao no mesmo pedido.
  const create = (input: FlashcardInput, reverse = false) =>
    run(async () => {
      const plan = reverse
        ? withReverseCards([input], cards.map((c) => c.front), cards.length)
        : null;
      if (!plan || plan.reverseCount === 0) {
        const card = await createFlashcard(input);
        setCards((prev) => [...prev, card]);
        notify(translateNow('ux4study.cardCreated'), 'success');
        if (plan) notify(translateNow('flashcards.reverseSkippedOne'), 'info');
        return;
      }
      try {
        await createFlashcards(plan.cards.map((c) => ({ ...c, areaId: input.areaId })));
        notify(translateNow('ux4study.cardsCreated', { count: plan.cards.length }), 'success');
      } finally {
        load();
      }
    });

  // Importacao em blocos (o backend aceita ate IMPORT_BATCH_MAX por pedido).
  const importMany = (inputs: FlashcardInput[]) =>
    run(async () => {
      try {
        for (const batch of chunkCards(inputs)) await createFlashcards(batch);
        notify(translateNow('ux4study.cardsImported', { count: inputs.length }), 'success');
      } finally {
        load();
      }
    });

  const update = (id: string, input: FlashcardInput) =>
    run(async () => {
      replace(await updateFlashcard(id, input));
      notify(translateNow('ux4study.cardUpdated'), 'success');
    });

  const remove = (id: string) => {
    const card = cards.find((c) => c.id === id);
    return run(async () => {
      await deleteFlashcard(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
      if (!card) return;
      // Recriar volta como cartao novo (a agenda de revisao recomeca).
      offerUndoDelete({
        message: translateNow('undoDelete.card'),
        restore: () => createFlashcard({ front: card.front, back: card.back, areaId: card.areaId }),
        onRestored: (restored) => setCards((prev) => [...prev, restored]),
      });
    });
  };

  // Em massa: um pedido por cartao, poucos de cada vez (ver lib/batch.ts).
  const removeMany = async (selected: Flashcard[]) => {
    const { done, failed } = await settleInBatches(selected, (c) => deleteFlashcard(c.id));
    if (failed.length > 0) notify(translateNow('flashcards.saveError'), 'error');
    if (done.length === 0) return;
    const gone = new Set(done.map((d) => d.item.id));
    setCards((prev) => prev.filter((c) => !gone.has(c.id)));
    offerUndoDelete({
      message: translateNow('ux4global.cards.deleted', { count: done.length }),
      restore: async () => {
        const inputs = done.map(({ item }) => ({ front: item.front, back: item.back, areaId: item.areaId }));
        try {
          for (const batch of chunkCards(inputs)) await createFlashcards(batch);
        } finally {
          load();
        }
      },
    });
  };

  const moveMany = async (selected: Flashcard[], areaId: string | null) => {
    const moving = selected.filter((c) => c.areaId !== areaId);
    const { done, failed } = await settleInBatches(moving, (c) => updateFlashcard(c.id, { areaId }));
    done.forEach(({ value }) => replace(value));
    if (failed.length > 0) notify(translateNow('flashcards.saveError'), 'error');
    else notify(translateNow('ux4global.cards.moved', { count: moving.length }), 'success');
  };

  const review = (id: string, grade: FlashcardGrade) => run(async () => replace(await reviewFlashcard(id, grade)));

  // Desfazer a ultima classificacao: repoe a agenda que o cartao tinha antes.
  const restore = (id: string, schedule: FlashcardSchedule) =>
    run(async () => replace(await restoreFlashcard(id, schedule)));

  return { cards, isLoading, error, reload: load, create, importMany, update, remove, removeMany, moveMany, review, restore };
}
