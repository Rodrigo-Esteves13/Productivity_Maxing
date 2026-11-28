import { Link } from 'react-router-dom';
import { useI18n } from '../../../i18n/useI18n';
import { socialTabPath } from '../../../lib/appLinks';
import Button from '../../UI/Button';
import { DownloadIcon, PlusIcon } from '../../UI/Icons';
import NotebookScheduleLink from '../NotebookScheduleLink';
import type { NotebookPageState } from '../../../hooks/useNotebookPage';
import type { Area } from '../../../types/models';

// Nome da cadeira aberta, contagens e acoes (exportar, nova nota).
export default function NotebookAreaHeader({ area, page }: { area: Area; page: NotebookPageState }) {
  const { t } = useI18n();
  const {
    entries,
    isLoading: entriesLoading,
    sharedInArea,
    createError,
    exportError,
    exportCourse,
    isExportingCourse,
    handleNewEntry,
    isCreating,
  } = page;

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 className="flex items-center gap-2.5 font-serif text-2xl font-semibold text-white">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: area.colorHex }} />
          <span className="truncate" title={area.name}>{area.name}</span>
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {!entriesLoading && (
            <span className="text-xs text-neutral-500">
              {t(entries.length === 1 ? 'notebook.entries.countOne' : 'notebook.entries.count', {
                count: entries.length,
              })}
            </span>
          )}
          {sharedInArea > 0 && (
            <Link to={socialTabPath('mine')} className="text-xs text-violet-400 hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center">
              {t(sharedInArea === 1 ? 'notebook.entries.sharedOne' : 'notebook.entries.shared', {
                count: sharedInArea,
              })}
            </Link>
          )}
          <NotebookScheduleLink areaId={area.id} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {createError && <span className="text-xs text-red-400">{createError}</span>}
        {exportError && (
          <span role="alert" className="text-xs text-red-400">
            {exportError}
          </span>
        )}
        {entries.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={() => void exportCourse()}
            disabled={isExportingCourse}
            title={t('notebook.export.courseHint')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            <DownloadIcon className="h-4 w-4" />
            {isExportingCourse ? t('notebook.export.exporting') : t('notebook.export.course')}
          </Button>
        )}
        <Button
          type="button"
          onClick={handleNewEntry}
          disabled={isCreating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {isCreating ? t('notebook.checkingSchedule') : t('notebook.newEntry')}
        </Button>
      </div>
    </div>
  );
}
