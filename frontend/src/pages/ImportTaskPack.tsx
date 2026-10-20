import { Link, useParams } from 'react-router-dom';
import PageLayout from '../components/Layout/PageLayout';
import PageHeader from '../components/Layout/PageHeader';
import ActionButton from '../components/UI/ActionButton';
import ErrorState from '../components/UI/ErrorState';
import TableSkeleton from '../components/UI/TableSkeleton';
import Select from '../components/UI/Select';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { useTaskPackImport } from '../hooks/useTaskPackImport';
import { useI18n } from '../i18n/useI18n';
import SelectionToolbar from '../components/UI/SelectionToolbar';

export default function ImportTaskPack() {
  const { t, lang } = useI18n();
  useDocumentTitle(t('packs.import.docTitle'));
  const { code } = useParams<{ code: string }>();
  const {
    state, preview, areas, selected, areaChoice, isImporting, result, importError, missingArea,
    toggle, selectAll, selectNone, chooseArea, runImport,
  } = useTaskPackImport(code);

  if (state === 'loading') {
    return <PageLayout><TableSkeleton rows={4} columns={3} /></PageLayout>;
  }
  if (state === 'not-found' || state === 'error' || !preview) {
    return (
      <PageLayout>
        <ErrorState message={state === 'not-found' ? t('packs.import.notFound') : t('packs.import.error')} />
      </PageLayout>
    );
  }

  if (result) {
    const errorById = new Map(result.results.filter((r) => !r.ok).map((r) => [r.itemId, r.error ?? '']));
    return (
      <PageLayout>
        <PageHeader title={t('packs.import.doneTitle')} description={t('packs.import.doneSummary', { created: result.created, failed: result.failed })} />
        {errorById.size > 0 && (
          <ul className="mb-6 space-y-2 text-sm text-red-300">
            {preview.items.filter((i) => errorById.has(i.id)).map((i) => (
              <li key={i.id}>{i.title}: {errorById.get(i.id)}</li>
            ))}
          </ul>
        )}
        <Link to="/tasks" className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500">
          {t('packs.import.goTasks')}
        </Link>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title={preview.name}
        description={t('packs.import.from', { name: preview.ownerName })}
        action={
          <ActionButton onClick={() => void runImport()} disabled={isImporting || selected.size === 0 || missingArea}>
            {isImporting ? t('packs.import.importing') : t('packs.import.submit', { count: selected.size })}
          </ActionButton>
        }
      />
      <p className="mb-4 text-sm text-neutral-400">{t('packs.import.intro')}</p>
      {importError && <ErrorState message={t('packs.import.error')} />}
      {missingArea && <p className="mb-3 text-sm text-amber-300">{t('packs.import.pickSubject')}</p>}
      <SelectionToolbar
        className="mb-3"
        selectedCount={selected.size}
        selectableCount={preview.items.length}
        onSelectAll={selectAll}
        onSelectNone={selectNone}
      />
      <ul className="space-y-2">
        {preview.items.map((item) => (
          <li key={item.id} className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 accent-violet-500"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-white">{item.title}</span>
                <span className="block text-xs text-neutral-500">
                  {new Date(item.date).toLocaleDateString(lang)}
                  {item.weightPercentage != null && ` · ${item.weightPercentage}%`}
                  {` · ${item.areaName}`}
                  {item.alreadyHave && ` · ${t('packs.import.alreadyHave')}`}
                </span>
              </span>
            </label>
            {item.fixedAreaId === null && selected.has(item.id) && (
              <Select
                aria-label={t('packs.import.subjectFor', { title: item.title })}
                className="mt-2 max-w-xs"
                value={areaChoice[item.id] ?? ''}
                onChange={(e) => chooseArea(item.id, e.target.value)}
              >
                <option value="">{t('packs.import.chooseSubject')}</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            )}
          </li>
        ))}
      </ul>
    </PageLayout>
  );
}
