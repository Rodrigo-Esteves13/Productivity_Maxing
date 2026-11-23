import { useCallback, useMemo, useState } from 'react';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import Card from '../components/UI/Card';
import EmptyState from '../components/UI/EmptyState';
import ErrorState from '../components/UI/ErrorState';
import CardGridSkeleton from '../components/UI/CardGridSkeleton';
import Button from '../components/UI/Button';
import SearchField from '../components/UI/SearchField';
import SegmentedControl, { type SegmentedOption } from '../components/UI/SegmentedControl';
import { DownloadIcon } from '../components/UI/Icons';
import PersonalNoteForm from '../components/PersonalNotes/PersonalNoteForm';
import PersonalNoteItem from '../components/PersonalNotes/PersonalNoteItem';
import MedicationPushWarning from '../components/Wellbeing/MedicationPushWarning';
import ConfirmActionDialog from '../components/Turma/ConfirmActionDialog';
import { useConfirmAction } from '../hooks/useConfirmAction';
import type { PersonalNote } from '../types/models';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { usePersonalNotes } from '../hooks/usePersonalNotes';
import { useListSearch } from '../hooks/useListSearch';
import { useI18n } from '../i18n/useI18n';
import { formatNumber } from '../lib/ratings';
import { formatDateTime } from '../lib/timeFormat';
import {
  NOTE_FILTERS,
  PERSONAL_NOTES_MAX,
  filterNotesByState,
  isNearNoteLimit,
  isNoteLimitReached,
  notesToText,
  type NoteFilter,
} from '../lib/personalNotesFilter';
import { downloadTextFile } from '../utils/downloadTextFile';

const FILTER_LABEL_KEY: Record<NoteFilter, string> = {
  all: 'ux4notes.filter.all',
  reminder: 'ux4notes.filter.reminder',
  done: 'ux4notes.filter.done',
  pinned: 'ux4notes.filter.pinned',
};

const EXPORT_FILE_NAME = 'notes.txt';
const EXPORT_MIME = 'text/plain;charset=utf-8';

// Notas pessoais soltas (fora das cadeiras do Notebook) e lembretes para
// o proprio: com hora marcada, chega um aviso push a essa hora.
export default function PersonalNotes() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('notes.title'));
  const { notes, isLoading, error, reload, create, update, remove } = usePersonalNotes();
  const [stateFilter, setStateFilter] = useState<NoteFilter>('all');
  const byState = useMemo(() => filterNotesByState(notes, stateFilter), [notes, stateFilter]);
  const { query, setQuery, filtered, isFiltering } = useListSearch(byState, (n) => [n.title, n.body]);
  const filterOptions: SegmentedOption<NoteFilter>[] = NOTE_FILTERS.map((value) => ({
    value,
    label: t(FILTER_LABEL_KEY[value]),
  }));
  const isNarrowed = isFiltering || stateFilter !== 'all';
  const isFull = isNoteLimitReached(notes.length);

  const exportNotes = () =>
    downloadTextFile(
      notesToText(notes, {
        done: t('ux4notes.export.done'),
        pinned: t('notes.pinned'),
        reminder: (iso) => t('ux4notes.export.reminder', { when: formatDateTime(iso) }),
      }),
      EXPORT_FILE_NAME,
      EXPORT_MIME,
    );
  const hasReminders = notes.some((n) => n.remindAt && !n.doneAt);
  const confirm = useConfirmAction(t('notes.saveError'));
  const { request } = confirm;

  const requestRemove = useCallback(
    (note: PersonalNote) =>
      request({
        title: t('notes.delete'),
        message: t('notes.deleteConfirm', { title: note.title }),
        confirmLabel: t('common.delete'),
        tone: 'danger',
        run: async () => {
          await remove(note.id);
        },
      }),
    [request, remove, t],
  );

  return (
    <PageLayout>
      <PageHeader title={t('notes.title')} description={t('notes.description')} />
      <Card className="mb-6">
        <PersonalNoteForm onSubmit={create} isFull={isFull} />
        {isNearNoteLimit(notes.length) && (
          <p className={`mt-2 text-xs ${isFull ? 'text-amber-400' : 'text-neutral-500'}`}>
            {t(isFull ? 'ux4notes.limitReached' : 'ux4notes.counter', {
              count: formatNumber(notes.length, lang, 0),
              max: formatNumber(PERSONAL_NOTES_MAX, lang, 0),
            })}
          </p>
        )}
      </Card>
      {/* Mesmo aviso dos lembretes de medicacao: sem push nao chega nada. */}
      <MedicationPushWarning hasReminders={hasReminders} />
      {isLoading ? (
        <CardGridSkeleton cards={3} />
      ) : error ? (
        <ErrorState message={t('notes.loadError')} onRetry={reload} />
      ) : notes.length === 0 ? (
        <EmptyState message={t('notes.empty')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <SearchField value={query} onChange={setQuery} label={t('ux4notes.search')} />
            <SegmentedControl size="sm" options={filterOptions} value={stateFilter} onChange={setStateFilter} />
            <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={exportNotes}>
              <DownloadIcon className="mr-1.5 inline h-4 w-4" aria-hidden="true" />
              {t('ux4notes.export')}
            </Button>
          </div>
          {isNarrowed && (
            <p className="mb-3 text-xs text-neutral-500" aria-live="polite">
              {t('search.count', { shown: filtered.length, total: notes.length })}
            </p>
          )}
          {filtered.length === 0 ? (
            <EmptyState message={isFiltering ? t('search.noResultsFor', { query: query.trim() }) : t('search.noResults')} />
          ) : (
            <ul className="space-y-3">
              {filtered.map((note) => (
                <PersonalNoteItem key={note.id} note={note} onUpdate={update} onRemove={requestRemove} />
              ))}
            </ul>
          )}
        </>
      )}
      <ConfirmActionDialog state={confirm} />
    </PageLayout>
  );
}
