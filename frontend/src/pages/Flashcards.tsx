import { useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import Select from '../components/UI/Select';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import CardEditor from '../components/Flashcards/CardEditor';
import DeckList from '../components/Flashcards/DeckList';
import ReviewSession from '../components/Flashcards/ReviewSession';
import { isDue } from '../components/Flashcards/decks';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { useAreaLookup } from '../hooks/useAreaLookup';
import { useFlashcards } from '../hooks/useFlashcards';
import { useNotebookAreas } from '../hooks/useNotebookAreas';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useI18n } from '../i18n/useI18n';
import type { Flashcard } from '../types/models';

// '' = todos; '-' = sem cadeira.
const ALL = '';
const NO_AREA = '-';

// Editor: fechado, novo cartao ou cartao existente.
type EditorState = null | 'new' | Flashcard;

export default function Flashcards() {
  const { t } = useI18n();
  useDocumentTitle(t('flashcards.title'));
  const { cards, isLoading, error, reload, create, update, remove, review } = useFlashcards();
  const { areas } = useNotebookAreas();
  const areaById = useAreaLookup(areas);
  const [filter, setFilter] = useState(ALL);
  const [editor, setEditor] = useState<EditorState>(null);
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  const confirm = useConfirmAction(t('flashcards.saveError'));

  const visible = useMemo(
    () =>
      filter === ALL ? cards : cards.filter((c) => (filter === NO_AREA ? c.areaId === null : c.areaId === filter)),
    [cards, filter],
  );
  const due = useMemo(() => visible.filter((c) => isDue(c, Date.now())), [visible]);

  const requestRemove = (card: Flashcard) =>
    confirm.request({
      title: t('flashcards.delete'),
      message: t('flashcards.deleteConfirm'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await remove(card.id);
      },
    });

  const startSession = () => setQueue([...due].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));

  return (
    <PageLayout>
      <PageHeader
        title={t('flashcards.title')}
        description={t('flashcards.description')}
        action={
          !queue && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditor('new')}>
                {t('flashcards.newCard')}
              </Button>
              <Button size="sm" disabled={due.length === 0} onClick={startSession}>
                {t('flashcards.study', { count: due.length })}
              </Button>
            </div>
          )
        }
      />
      {queue ? (
        <ReviewSession queue={queue} onGrade={review} onExit={() => setQueue(null)} />
      ) : isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('flashcards.loadError')} onRetry={reload} />
      ) : cards.length === 0 ? (
        <EmptyState message={t('flashcards.empty')} />
      ) : (
        <>
          <div className="mb-4 max-w-xs">
            <Select aria-label={t('flashcards.area')} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value={ALL}>{t('flashcards.allAreas')}</option>
              <option value={NO_AREA}>{t('flashcards.noArea')}</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
          {visible.length === 0 ? (
            <EmptyState message={t('flashcards.emptyFilter')} />
          ) : (
            <DeckList cards={visible} areaById={areaById} onEdit={setEditor} onRemove={requestRemove} />
          )}
        </>
      )}
      {editor && (
        <CardEditor
          card={editor === 'new' ? undefined : editor}
          defaultAreaId={filter && filter !== NO_AREA ? filter : null}
          areas={areas}
          onSubmit={(input) => (editor === 'new' ? create(input) : update(editor.id, input))}
          onClose={() => setEditor(null)}
        />
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
