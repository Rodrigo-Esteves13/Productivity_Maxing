import { useEffect, useMemo, useRef, useState, type Dispatch, type KeyboardEvent as ReactKeyboardEvent, type SetStateAction } from 'react';
import { useAuth } from '../../context/useAuth';
import { getLastUsedAreaId } from '../../lib/lastUsedArea';
import { usePaletteShortcutsPref } from '../../hooks/usePaletteShortcutsPref';
import { SearchIcon } from '../UI/Icons';
import { useEscapeLayer } from '../UI/modalStack';
import { useI18n } from '../../i18n/useI18n';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';
import { actionForKey, paletteTaskActions, resolveAction, shortcutLabel } from '../../lib/paletteActions';
import { buildPaletteItems } from './buildPaletteItems';
import { usePaletteData } from './usePaletteData';
import { usePaletteActions } from './usePaletteActions';
import PaletteQuickAddRow from './PaletteQuickAddRow';
import PaletteResultRow from './PaletteResultRow';
import { IS_MAC } from './platform';

interface CommandPaletteProps {
  isOpen: boolean;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

// Carregado a pedido pelo CommandPaletteHost (que tem o Ctrl+K e o evento
// do botao de pesquisa): este ficheiro e pesado e nao precisa de ir no JS
// que abre a app.
export default function CommandPalette({ isOpen, setIsOpen }: CommandPaletteProps) {
  const { isAuthenticated, user } = useAuth();
  const { t } = useI18n();
  const { enabled: shortcutsEnabled } = usePaletteShortcutsPref();
  // Fica montada durante a animacao de saida (data-state="closed").
  const { mounted, state } = usePresence(isOpen, MODAL_EXIT_MS);

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { recents, setRecents, setTasks, tasksLoaded, taskIndex, notebookResults, turmaNoteResults, areas } =
    usePaletteData({ isOpen, query, userId: user?.id, shortcutsEnabled });
  const { isCreating, createError, setCreateError, selectItem, runTaskAction, actionContext } = usePaletteActions({
    setIsOpen,
    userId: user?.id,
    shortcutsEnabled,
    taskIndex,
    tasksLoaded,
    setTasks,
    setRecents,
  });

  // O Ctrl+K e o evento do botao da Navbar vivem no CommandPaletteHost.

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    setCreateError('');
    // Autofocus needs a tick - the input isn't in the DOM yet on the same
    // render that flips isOpen to true.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen, setCreateError]);

  // Na pilha de modais: com a paleta por cima de um formulario, o Escape fecha
  // so a paleta.
  useEscapeLayer(isOpen, () => setIsOpen(false));

  const items = useMemo(
    () =>
      buildPaletteItems({
        query,
        taskIndex,
        tasksLoaded,
        notebookResults,
        turmaNoteResults,
        areas,
        lastUsedAreaId: getLastUsedAreaId(),
        isAdmin: user?.role === 'ADMIN',
        recents,
        shortcutsEnabled,
        t,
      }),
    [query, taskIndex, notebookResults, turmaNoteResults, user, areas, t, recents, shortcutsEnabled, tasksLoaded],
  );

  // Clamp instead of reset-on-every-keystroke - keeps the highlighted row
  // stable when it's still a valid index after the result list shrinks.
  const clampedIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[clampedIndex];
      if (!item) return;
      if (item.kind === 'task') {
        // Ctrl/Cmd+Enter feita, Shift+Enter amanha, Ctrl/Cmd+Shift+Enter focar.
        const requested = actionForKey(e);
        if (requested) {
          const action = resolveAction(item.task, requested, actionContext);
          if (action) void runTaskAction(item.task, action);
          return;
        }
      }
      selectItem(item);
    }
  };

  if (!isAuthenticated || !mounted) return null;

  const activeItem = items[clampedIndex];
  const activeTaskActions =
    activeItem?.kind === 'task' ? paletteTaskActions(activeItem.task, actionContext) : [];

  return (
    <div
      data-state={state}
      className="motion-backdrop fixed inset-0 z-50 flex items-start justify-center pt-[15vh] p-4 bg-black/80 backdrop-blur-sm"
      onClick={() => setIsOpen(false)}
    >
      <div
        data-state={state}
        data-command-palette=""
        role="dialog"
        aria-modal="true"
        aria-label={t('paletteActions.dialog')}
        className="motion-modal w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
          <SearchIcon className="shrink-0 text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            className="flex-1 bg-transparent text-white placeholder:text-neutral-500 outline-none text-sm"
          />
          <kbd className="hidden sm:inline text-[10px] text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">
            {t('ui.esc')}
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {items.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">{t('palette.noMatches')}</p>
          )}
          {createError && (
            <p role="alert" className="px-4 py-2 text-xs text-red-400">
              {createError}
            </p>
          )}
          {items.map((item, index) => {
            const rowClass = `w-full flex items-center justify-between gap-3 text-left px-4 py-2 text-sm ${
              index === clampedIndex
                ? 'bg-violet-500/15 text-white'
                : 'text-neutral-300 hover:bg-neutral-800'
            }`;

            if (item.kind === 'quick-add') {
              return (
                <PaletteQuickAddRow
                  key="quick-add"
                  item={item}
                  rowClass={rowClass}
                  isCreating={isCreating}
                  areasLoaded={areas !== null}
                  onSelect={() => selectItem(item)}
                  onHover={() => setActiveIndex(index)}
                />
              );
            }

            return (
              <PaletteResultRow
                key={`${item.kind}-${item.id}`}
                item={item}
                rowClass={rowClass}
                taskActions={index === clampedIndex ? activeTaskActions : []}
                onSelect={() => selectItem(item)}
                onHover={() => setActiveIndex(index)}
                onTaskAction={(task, id) => void runTaskAction(task, id)}
              />
            );
          })}
        </div>

        {shortcutsEnabled && (
          <p className="hidden border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-500 sm:block">
            {t('paletteShortcuts.footerHint')}
          </p>
        )}

        {activeTaskActions.length > 0 && (
          <p className="hidden border-t border-neutral-800 px-4 py-2 text-[10px] text-neutral-500 sm:block">
            {t('paletteActions.hint', {
              done: shortcutLabel({ mod: true, shift: false }, IS_MAC),
              postpone: shortcutLabel({ mod: false, shift: true }, IS_MAC),
              focus: shortcutLabel({ mod: true, shift: true }, IS_MAC),
            })}
          </p>
        )}
      </div>
    </div>
  );
}
