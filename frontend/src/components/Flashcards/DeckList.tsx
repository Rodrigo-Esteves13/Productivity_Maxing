import ColorDot from '../UI/ColorDot';
import IconButton from '../UI/IconButton';
import { PencilIcon, TrashIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';
import { groupDecks, isDue } from './decks';
import type { Area, Flashcard } from '../../types/models';

interface DeckListProps {
  cards: Flashcard[];
  areaById: Map<string, Area>;
  onEdit: (card: Flashcard) => void;
  onRemove: (card: Flashcard) => void;
}

export default function DeckList({ cards, areaById, onEdit, onRemove }: DeckListProps) {
  const { t } = useI18n();
  const now = Date.now();

  return (
    <div className="space-y-6">
      {groupDecks(cards, now).map((deck) => {
        const area = deck.areaId ? areaById.get(deck.areaId) : undefined;
        return (
          <section key={deck.areaId ?? 'none'} aria-label={area?.name ?? t('flashcards.noArea')}>
            <h2 className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-neutral-200">
              {area && <ColorDot color={area.colorHex} size="xs" />}
              <span className="min-w-0 break-words">{area?.name ?? t('flashcards.noArea')}</span>
              <span className="text-xs font-normal tabular-nums text-neutral-400">
                {t('flashcards.deckCount', { count: deck.cards.length, due: deck.due })}
              </span>
            </h2>
            <ul className="space-y-2">
              {deck.cards.map((card) => (
                <li
                  key={card.id}
                  className="flex items-start gap-3 rounded-xl border border-neutral-800 bg-neutral-900/50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-medium text-white">{card.front}</p>
                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-neutral-400">
                      {card.back}
                    </p>
                  </div>
                  {isDue(card, now) && (
                    <span className="shrink-0 rounded-full border border-violet-700 px-2 py-0.5 text-xs text-violet-300">
                      {t('flashcards.due')}
                    </span>
                  )}
                  <div className="flex shrink-0">
                    <IconButton label={t('flashcards.edit')} className="h-10 w-10" onClick={() => onEdit(card)}>
                      <PencilIcon className="mx-auto h-4 w-4" />
                    </IconButton>
                    <IconButton
                      label={t('common.delete')}
                      tone="danger"
                      className="h-10 w-10"
                      onClick={() => onRemove(card)}
                    >
                      <TrashIcon className="mx-auto h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
