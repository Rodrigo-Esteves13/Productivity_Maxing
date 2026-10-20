import { Link } from 'react-router-dom';
import type { NotebookEntrySummary, NotebookEntryType } from '../../types/models';
import { ENTRY_TYPE_ICON } from '../../hooks/useEntryTypeOptions';
import { countByType, entryPreview, missingClassNumbers, relativeDay } from '../../lib/notebookOverview';
import { socialTabPath } from '../../lib/appLinks';
import { useI18n } from '../../i18n/useI18n';
import { PlusIcon } from '../UI/Icons';
import Button from '../UI/Button';

const RECENT_COUNT = 4;
// Mais do que isto vira uma lista enorme: mostra as primeiras e "..."
const MISSING_SHOWN = 6;

const TYPE_LABEL_KEY: Record<NotebookEntryType, string> = {
  CLASS: 'notebook.type.class',
  NOTE: 'notebook.type.note',
  STUDY: 'notebook.type.study',
};

interface Props {
  entries: NotebookEntrySummary[];
  isCreating: boolean;
  onSelect: (entry: NotebookEntrySummary) => void;
  onNewEntry: () => void;
}

function EntryHeading({ entry }: { entry: NotebookEntrySummary }) {
  const { t } = useI18n();
  const Icon = ENTRY_TYPE_ICON[entry.entryType];
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
      <span className="truncate font-medium text-white">
        {entry.entryType === 'CLASS' && entry.classNumber != null && (
          <span className="mr-1 text-violet-400">#{entry.classNumber}</span>
        )}
        {entry.title || t('notebook.untitled')}
      </span>
    </span>
  );
}

// O que aparece ao lado da lista quando nenhuma entrada esta aberta: em vez de
// uma caixa vazia, continuar a ultima entrada, o que ha nesta cadeira e as
// aulas que ficaram sem notas.
export default function NotebookAreaOverview({ entries, isCreating, onSelect, onNewEntry }: Props) {
  const { t, lang } = useI18n();

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900/30 px-6 py-10 text-center">
        <p className="font-serif text-lg font-semibold text-white">{t('notebook.overview.emptyTitle')}</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-neutral-400">{t('notebook.overview.emptyHint')}</p>
        <Button
          type="button"
          onClick={onNewEntry}
          disabled={isCreating}
          className="mx-auto mt-4 flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {isCreating ? t('notebook.checkingSchedule') : t('notebook.newEntry')}
        </Button>
      </div>
    );
  }

  const [latest, ...rest] = entries;
  const recent = rest.slice(0, RECENT_COUNT);
  const counts = countByType(entries);
  const missing = missingClassNumbers(entries);
  const missingLabel =
    missing
      .slice(0, MISSING_SHOWN)
      .map((n) => `#${n}`)
      .join(', ') + (missing.length > MISSING_SHOWN ? '…' : '');
  const latestPreview = entryPreview(latest.preview, 220);

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => onSelect(latest)}
        className="group block w-full rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-left transition-colors hover:border-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-violet-300">
          {t('notebook.overview.continue')}
        </span>
        <span className="mt-2 flex items-center justify-between gap-3 text-base">
          <EntryHeading entry={latest} />
          <span className="shrink-0 text-xs text-neutral-500">{relativeDay(latest.date, lang)}</span>
        </span>
        {latestPreview && (
          <span className="mt-1.5 line-clamp-3 block font-serif text-sm leading-relaxed text-neutral-300">
            {latestPreview}
          </span>
        )}
      </button>

      <dl className="grid grid-cols-3 gap-2">
        {(Object.keys(TYPE_LABEL_KEY) as NotebookEntryType[]).map((type) => {
          const Icon = ENTRY_TYPE_ICON[type];
          return (
            <div key={type} className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
              <dt className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Icon className="h-3 w-3" />
                {t(TYPE_LABEL_KEY[type])}
              </dt>
              <dd className="text-xl font-bold tabular-nums text-white">{counts[type]}</dd>
            </div>
          );
        })}
      </dl>

      {missing.length > 0 && (
        <div className="rounded-lg border border-amber-800/40 bg-amber-900/10 px-3 py-2.5 text-sm text-amber-200">
          {t('notebook.overview.missing', { list: missingLabel })}{' '}
          <Link to={socialTabPath('friends')} className="whitespace-nowrap text-amber-300 underline hover:text-amber-100">
            {t('notebook.overview.askFriend')}
          </Link>
        </div>
      )}

      {recent.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t('notebook.overview.recent')}
          </h3>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.map((entry) => {
              const preview = entryPreview(entry.preview, 140);
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(entry)}
                    className="flex h-full w-full flex-col rounded-lg border border-neutral-800 bg-neutral-900/40 p-3 text-left text-sm transition-colors hover:border-violet-800 hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <EntryHeading entry={entry} />
                      <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                        {new Date(entry.date).toLocaleDateString(lang, { day: '2-digit', month: '2-digit' })}
                      </span>
                    </span>
                    {preview && <span className="mt-1 line-clamp-2 text-xs text-neutral-400">{preview}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
