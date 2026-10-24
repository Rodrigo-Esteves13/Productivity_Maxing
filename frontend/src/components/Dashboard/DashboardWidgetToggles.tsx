import { useState, useRef, useEffect } from 'react';
import { WIDGET_LABELS, type DashboardWidgetKey } from '../../hooks/useDashboardWidgetPrefs';
import { SlidersIcon } from '../UI/Icons';
import ToolbarButton from '../UI/ToolbarButton';
import { useI18n } from '../../i18n/useI18n';

interface DashboardWidgetTogglesProps {
  visibility: Record<DashboardWidgetKey, boolean>;
  toggle: (key: DashboardWidgetKey) => void;
}

// A gear-style dropdown to show/hide the optional dashboard widgets - the
// lightweight version of "customizable dashboard": no drag-to-reorder
// (not worth the complexity for a handful of widgets), just "I don't
// want to see this one". Preference persists locally (see
// useDashboardWidgetPrefs).
export function DashboardWidgetToggles({ visibility, toggle }: DashboardWidgetTogglesProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

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

      {isOpen && (
        <div className="motion-dropdown origin-top-right absolute right-0 z-10 mt-2 w-64 rounded-lg border border-neutral-800 bg-neutral-900 p-3 shadow-xl">
          <p className="text-xs uppercase tracking-wide text-neutral-500 mb-2 flex items-center gap-1.5">
            <SlidersIcon className="shrink-0" />
            {t('widget.showOnDashboard')}
          </p>
          <ul className="space-y-2">
            {(Object.keys(WIDGET_LABELS) as DashboardWidgetKey[]).map((key) => (
              <li key={key}>
                <label className="flex items-center gap-2 text-sm text-neutral-200 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={visibility[key]}
                    onChange={() => toggle(key)}
                    className="accent-violet-500"
                  />
                  {t(WIDGET_LABELS[key])}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
