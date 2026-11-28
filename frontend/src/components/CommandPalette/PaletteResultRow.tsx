import { SECTION_LABEL_KEY, owningPage } from '../../lib/siteMap';
import { shortcutLabel, type PaletteTaskAction, type PaletteTaskActionId } from '../../lib/paletteActions';
import { useI18n } from '../../i18n/useI18n';
import type { Task } from '../../types/models';
import type { PaletteItem } from './buildPaletteItems';
import { IS_MAC } from './platform';

interface PaletteResultRowProps {
  item: Exclude<PaletteItem, { kind: 'quick-add' }>;
  rowClass: string;
  // Acoes rapidas a mostrar por baixo (so na linha de task destacada).
  taskActions: PaletteTaskAction[];
  onSelect: () => void;
  onHover: () => void;
  onTaskAction: (task: Task, id: PaletteTaskActionId) => void;
}

// Uma linha de resultado (nav, recente, task, caderno ou nota de turma).
export default function PaletteResultRow({ item, rowClass, taskActions, onSelect, onHover, onTaskAction }: PaletteResultRowProps) {
  const { t } = useI18n();

  // Paginas mostram a secao do mapa (Estudo, Em conjunto...), a mesma do
  // trilho no topo de cada pagina.
  const navSectionLabel = (path: string) => {
    const section = owningPage(path)?.section;
    return section ? t(SECTION_LABEL_KEY[section]) : t('palette.kind.nav');
  };

  return (
    <>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className={rowClass}
      >
        <span className="min-w-0">
          <span className="block truncate" title={item.label}>{item.label}</span>
          {item.kind === 'task' && item.detail && (
            <span
              className="block truncate text-xs text-neutral-500"
              title={`${item.detail.prefix} ${item.detail.snippet.before}${item.detail.snippet.match}${item.detail.snippet.after}`}
            >
              <span className="text-neutral-400">{item.detail.prefix} </span>
              {item.detail.snippet.before}
              <mark className="bg-transparent text-violet-300">{item.detail.snippet.match}</mark>
              {item.detail.snippet.after}
            </span>
          )}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0">
          {item.kind === 'nav' || (item.kind === 'recent' && item.recent.kind === 'nav')
            ? navSectionLabel(item.path)
            : t(`palette.kind.${item.kind === 'recent' ? item.recent.kind : item.kind}`)}
        </span>
      </button>
      {item.kind === 'task' && taskActions.length > 0 && (
        <div
          role="group"
          aria-label={t('paletteActions.group')}
          className="flex flex-wrap gap-1.5 bg-violet-500/15 px-4 pb-2"
        >
          {taskActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onTaskAction(item.task, action.id)}
              className="press inline-flex min-h-10 items-center gap-2 rounded-md border border-neutral-700 px-3 text-xs text-neutral-200 hover:border-neutral-600 hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-400"
            >
              {t(action.labelKey)}
              <kbd className="hidden text-[10px] text-neutral-500 sm:inline">{shortcutLabel(action, IS_MAC)}</kbd>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
