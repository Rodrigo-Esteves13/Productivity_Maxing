import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Button from '../components/UI/Button';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import Select from '../components/UI/Select';
import SearchField from '../components/UI/SearchField';
import ToggleChip from '../components/UI/ToggleChip';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import CardEditor from '../components/Flashcards/CardEditor';
import DeckList from '../components/Flashcards/DeckList';
import CardBulkBar from '../components/Flashcards/CardBulkBar';
import { BULK_ACTION_MAX } from '../lib/batch';
import ImportCardsModal from '../components/Flashcards/ImportCardsModal';
import FlashcardForecast from '../components/Flashcards/FlashcardForecast';
import ReviewSession from '../components/Flashcards/ReviewSession';
import PracticeTest from '../components/Flashcards/PracticeTest';
import { TEST_MIN_CARDS } from '../lib/flashcardTest';
import { isDue } from '../components/Flashcards/decks';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import { LEECH_LAPSES, isLeech } from '../lib/flashcardLeech';
import { useListSearch } from '../hooks/useListSearch';
import { CARD_SORTS, DEFAULT_CARD_SORT, cardsToTsv, type CardSort } from '../lib/flashcardList';
import { downloadTextFile } from '../utils/downloadTextFile';
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
  const { cards, isLoading, error, reload, create, importMany, update, remove, removeMany, moveMany, review, restore } =
    useFlashcards();
  const { areas } = useNotebookAreas();
  const areaById = useAreaLookup(areas);
  const [filter, setFilter] = useState(ALL);
  const [onlyHard, setOnlyHard] = useState(false);
  const [sort, setSort] = useState<CardSort>(DEFAULT_CARD_SORT);
  const [editor, setEditor] = useState<EditorState>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [queue, setQueue] = useState<Flashcard[] | null>(null);
  // ?test=1 (paleta) abre logo o teste de pratica.
  const [searchParams] = useSearchParams();
  const [isTesting, setIsTesting] = useState(searchParams.get('test') === '1');
  const confirm = useConfirmAction(t('flashcards.saveError'));

  const inArea = useMemo(
    () =>
      filter === ALL ? cards : cards.filter((c) => (filter === NO_AREA ? c.areaId === null : c.areaId === filter)),
    [cards, filter],
  );
  // Previsao depende de quantidade, area e vencimento das cartas.
  const forecastKey = useMemo(
    () => cards.map((c) => `${c.id}:${c.areaId ?? ''}:${c.dueAt}`).join('|'),
    [cards],
  );
  const hardCount = useMemo(() => inArea.filter(isLeech).length, [inArea]);
  const hardFiltered = useMemo(() => (onlyHard ? inArea.filter(isLeech) : inArea), [inArea, onlyHard]);
  // Pesquisa so mexe na lista; estudar e testar seguem a cadeira escolhida.
  const search = useListSearch(hardFiltered, (c) => [c.front, c.back]);
  const visible = search.filtered;
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // So conta o que esta a vista: mudar o filtro nunca apaga cartoes escondidos.
  const selected = visible.filter((c) => picked.has(c.id));
  const selectedIds = new Set(selected.map((c) => c.id));
  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (!next.delete(id) && next.size < BULK_ACTION_MAX) next.add(id);
    setPicked(next);
  };
  const requestRemoveSelected = async () =>
    confirm.request({
      title: t('flashcards.delete'),
      message: t('ux4global.cards.confirmDelete', { count: selected.length }),
      confirmLabel: t('common.delete'),
      tone: 'danger',
      run: async () => {
        await removeMany(selected);
        setPicked(new Set());
      },
    });
  // So abre o teste quando ha cartas suficientes no filtro.
  const showTest = isTesting && inArea.length >= TEST_MIN_CARDS;
  // Estudar e testar seguem o filtro de area; "Hard cards" so muda a lista.
  const due = useMemo(() => inArea.filter((c) => isDue(c, Date.now())), [inArea]);

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

  const exportCards = () =>
    downloadTextFile(
      cardsToTsv(visible),
      `pmaxing_flashcards_${new Date().toISOString().slice(0, 10)}.tsv`,
      'text/tab-separated-values;charset=utf-8',
    );

  const startSession = () => setQueue([...due].sort((a, b) => a.dueAt.localeCompare(b.dueAt)));

  return (
    <PageLayout>
      <PageHeader
        title={t('flashcards.title')}
        description={t('flashcards.description')}
        action={
          !queue &&
          !showTest && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditor('new')}>
                {t('flashcards.newCard')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setIsImporting(true)}>
                {t('flashcardImport.button')}
              </Button>
              <Button variant="secondary" size="sm" disabled={visible.length === 0} onClick={exportCards}>
                {t('ux4study.export')}
              </Button>
              <Button variant="secondary" size="sm" disabled={inArea.length < TEST_MIN_CARDS} onClick={() => setIsTesting(true)}>
                {t('flashcardTest.button')}
              </Button>
              <Button size="sm" disabled={due.length === 0} onClick={startSession}>
                {t('flashcards.study', { count: due.length })}
              </Button>
            </div>
          )
        }
      />
      {queue ? (
        <ReviewSession queue={queue} onGrade={review} onUndo={restore} onExit={() => setQueue(null)} />
      ) : showTest ? (
        <PracticeTest cards={inArea} onExit={() => setIsTesting(false)} />
      ) : isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('flashcards.loadError')} onRetry={reload} />
      ) : cards.length === 0 ? (
        <EmptyState message={t('flashcards.empty')} />
      ) : (
        <>
          <FlashcardForecast refreshKey={forecastKey} />
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchField value={search.query} onChange={search.setQuery} label={t('ux4study.search')} />
            <div className="w-full max-w-xs">
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
            <div className="w-full max-w-[12rem]">
              <Select aria-label={t('ux4study.sortLabel')} value={sort} onChange={(e) => setSort(e.target.value as CardSort)}>
                {CARD_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`ux4study.sort.${s}`)}
                  </option>
                ))}
              </Select>
            </div>
            <ToggleChip
              pressed={onlyHard}
              onClick={() => setOnlyHard((v) => !v)}
              title={t('flashcards.hardHelp', { count: LEECH_LAPSES })}
            >
              {t('flashcards.hard', { count: hardCount })}
            </ToggleChip>
          </div>
          {visible.length === 0 ? (
            <EmptyState
              message={
                search.isFiltering
                  ? t('search.noResultsFor', { query: search.query.trim() })
                  : onlyHard
                    ? t('flashcards.emptyHard')
                    : t('flashcards.emptyFilter')
              }
            />
          ) : (
            <>
              {search.isFiltering && (
                <p className="mb-3 text-xs tabular-nums text-neutral-400" role="status">
                  {t('search.count', { shown: visible.length, total: hardFiltered.length })}
                </p>
              )}
              <CardBulkBar
                selectedCount={selected.length}
                listCount={visible.length}
                areas={areas}
                onSelectAll={() => setPicked(new Set(visible.slice(0, BULK_ACTION_MAX).map((c) => c.id)))}
                onSelectNone={() => setPicked(new Set())}
                onMove={async (areaId) => {
                  await moveMany(selected, areaId);
                  setPicked(new Set());
                }}
                onDelete={requestRemoveSelected}
              />
              <DeckList
                cards={visible}
                areaById={areaById}
                onEdit={setEditor}
                onRemove={requestRemove}
                sort={sort}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
              />
            </>
          )}
        </>
      )}
      {editor && (
        <CardEditor
          card={editor === 'new' ? undefined : editor}
          defaultAreaId={filter && filter !== NO_AREA ? filter : null}
          areas={areas}
          onSubmit={(input, reverse) => (editor === 'new' ? create(input, reverse) : update(editor.id, input))}
          onClose={() => setEditor(null)}
        />
      )}
      {isImporting && (
        <ImportCardsModal
          areas={areas}
          existingFronts={cards.map((c) => c.front)}
          existingCount={cards.length}
          defaultAreaId={filter && filter !== NO_AREA ? filter : null}
          onImport={(imported, areaId) => importMany(imported.map((card) => ({ ...card, areaId })))}
          onClose={() => setIsImporting(false)}
        />
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
