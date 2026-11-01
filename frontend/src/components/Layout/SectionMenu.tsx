import { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PrefetchLink from '../UI/PrefetchLink';
import { ChevronDownIcon, SearchIcon } from '../UI/Icons';
import { OPEN_COMMAND_PALETTE_EVENT } from '../CommandPalette/CommandPaletteHost';
import { useAuth } from '../../context/useAuth';
import { useI18n } from '../../i18n/useI18n';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';
import { SECTION_LABEL_KEY, owningPage, pagesInSection, type SiteSection } from '../../lib/siteMap';

// Primeiro passo do trilho: o nome da secao abre as paginas irmas, para
// saltar de Tasks para Schedule sem voltar ao menu de cima. Sem sessao (as
// paginas legais) e so texto: as outras paginas pediam login.
export default function SectionMenu({ section }: { section: SiteSection }) {
  const { t } = useI18n();
  const { user, isAuthenticated } = useAuth();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const { mounted, state } = usePresence(isOpen, MODAL_EXIT_MS);
  const pages = pagesInSection(section, user?.role === 'ADMIN');
  const current = owningPage(pathname)?.path;

  useEffect(() => {
    if (!isOpen) return undefined;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  const label = t(SECTION_LABEL_KEY[section]);
  if (!isAuthenticated || pages.length < 2) {
    return <span className="text-neutral-500">{label}</span>;
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={t('map.sectionMenu', { section: label })}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
      >
        {label}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {mounted && (
        <div
          id={menuId}
          data-state={state}
          className="motion-dropdown data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.99] data-[state=closed]:duration-[var(--duration-quick)] data-[state=closed]:pointer-events-none absolute left-0 z-40 mt-1.5 w-max min-w-52 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 py-1 shadow-2xl"
        >
          <ul>
            {pages.map((page) => {
              const isCurrent = page.path === current;
              return (
                <li key={page.path}>
                  <PrefetchLink
                    to={page.path}
                    onClick={() => setIsOpen(false)}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-neutral-800 hover:text-white ${
                      isCurrent ? 'font-medium text-white' : 'text-neutral-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${isCurrent ? 'bg-violet-400' : 'bg-transparent'}`}
                    />
                    {t(page.labelKey)}
                  </PrefetchLink>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
            }}
            className="mt-1 flex w-full items-center gap-2 border-t border-neutral-800 px-3 py-2 text-left text-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <SearchIcon className="h-3.5 w-3.5 shrink-0" />
            {t('map.allPages')}
          </button>
        </div>
      )}
    </div>
  );
}
