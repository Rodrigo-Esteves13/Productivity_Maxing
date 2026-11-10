import { useState, useRef, useEffect } from 'react';
import { WIDGET_LABELS, type DashboardWidgetKey } from '../../hooks/useDashboardWidgetPrefs';
import { GRID_WIDGET_DEFAULT_ORDER } from '../../hooks/useDashboardWidgetOrder';
import { ArrowDownIcon, ArrowUpIcon, SlidersIcon, UndoIcon } from '../UI/Icons';
import IconButton from '../UI/IconButton';
import ToolbarButton from '../UI/ToolbarButton';
import { useI18n } from '../../i18n/useI18n';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';

interface WidgetOrderControls {
  order: readonly DashboardWidgetKey[];
  moveUp: (key: DashboardWidgetKey) => void;
  moveDown: (key: DashboardWidgetKey) => void;
  reset: () => void;
  isDefault: boolean;
}

interface DashboardWidgetTogglesProps {
  visibility: Record<DashboardWidgetKey, boolean>;
  toggle: (key: DashboardWidgetKey) => void;
  orderControls: WidgetOrderControls;
}

// Widgets com lugar fixo fora do grid (sem botoes de ordem).
const FIXED_WIDGET_KEYS = (Object.keys(WIDGET_LABELS) as DashboardWidgetKey[]).filter(
  (key) => !GRID_WIDGET_DEFAULT_ORDER.includes(key),
);

// A gear-style dropdown to show/hide the dashboard widgets and reorder the
// ones in the card grid (move up / move down, keyboard friendly). Both
// preferences persist locally (useDashboardWidgetPrefs / useDashboardWidgetOrder).
export function DashboardWidgetToggles({ visibility, toggle, orderControls }: DashboardWidgetTogglesProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { mounted, state } = usePresence(isOpen, MODAL_EXIT_MS);
  const { order, moveUp, moveDown, reset, isDefault } = orderControls;

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const renderToggle = (key: DashboardWidgetKey) => (
    <label className="flex flex-1 min-w-0 items-center gap-2 text-sm text-neutral-200 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={visibility[key]}
        onChange={() => toggle(key)}
        className="accent-violet-500"
      />
      <span className="truncate">{t(WIDGET_LABELS[key])}</span>
    </label>
  );

  return (
    <div className="relative" ref={ref}>
      <ToolbarButton
        tone="muted"
        size="md"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        {t('ui.customizeWidgets')}
      </ToolbarButton>

      {mounted && (
        <div data-state={state} className="motion-dropdown data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.99] data-[state=closed]:duration-[var(--duration-quick)] data-[state=closed]:pointer-events-none origin-top-right absolute right-0 z-10 mt-2 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-xl">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2 flex items-center gap-1.5">
            <SlidersIcon className="shrink-0" />
            {t('widget.showOnDashboard')}
          </p>
          <ul className="space-y-1" aria-label={t('widgetOrder.listLabel')}>
            {order.map((key, index) => {
              const name = t(WIDGET_LABELS[key]);
              return (
                <li key={key} className="flex items-center gap-1">
                  {renderToggle(key)}
                  <IconButton
                    label={t('widgetOrder.moveUp', { name })}
                    onClick={() => moveUp(key)}
                    disabled={index === 0}
                    className="!min-h-8 !min-w-8 !p-1"
                  >
                    <ArrowUpIcon size={14} />
                  </IconButton>
                  <IconButton
                    label={t('widgetOrder.moveDown', { name })}
                    onClick={() => moveDown(key)}
                    disabled={index === order.length - 1}
                    className="!min-h-8 !min-w-8 !p-1"
                  >
                    <ArrowDownIcon size={14} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
          <ul className="space-y-2 mt-2 pt-2 border-t border-neutral-800">
            {FIXED_WIDGET_KEYS.map((key) => (
              <li key={key} className="flex items-center">
                {renderToggle(key)}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={reset}
            disabled={isDefault}
            className="press mt-3 inline-flex items-center gap-1.5 text-xs text-neutral-400 hover:text-white disabled:opacity-50 disabled:hover:text-neutral-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 rounded"
          >
            <UndoIcon size={14} />
            {t('widgetOrder.reset')}
          </button>
        </div>
      )}
    </div>
  );
}
