import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PrefetchLink from '../UI/PrefetchLink';
import { BAR_PATHS, isNavActive, navGroups } from './navItems';
import { SECTION_LABEL_KEY } from '../../lib/siteMap';
import type { User } from '../../types/models';
import { LogoutIcon } from '../UI/Icons';
import Avatar from '../Profile/Avatar';
import { useI18n } from '../../i18n/useI18n';
import { MODAL_EXIT_MS, usePresence } from '../../hooks/usePresence';

// Lazy e montado so quando aberto: quase ninguem envia feedback numa visita.
const FeedbackModal = lazy(() => import('../Feedback/FeedbackModal'));

// O que nao cabe na barra, pelas secoes do trilho e do rodape. Em duas
// colunas para nao passar a altura de um portatil.
const GROUPS = navGroups(BAR_PATHS);
const ITEM_CLASS = 'block rounded-md px-3 py-1.5 text-sm break-words transition-colors hover:bg-neutral-800 hover:text-white';

interface UserMenuProps {
  user: User | null;
  onLogout: () => void;
}

function getInitials(user: User): string {
  if (user.name) return user.name.substring(0, 2).toUpperCase();
  return user.email.substring(0, 2).toUpperCase();
}

function getFirstName(user: User): string {
  if (user.name) return user.name.trim().split(' ')[0];
  return user.email.split('@')[0];
}

export default function UserMenu({ user, onLogout }: UserMenuProps) {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  // Fica montado durante a animacao de saida (data-state="closed").
  const { mounted, state } = usePresence(isOpen, MODAL_EXIT_MS);

  // Fecha o menu ao clicar fora dele ou com Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  // Ainda a carregar os dados reais do user: mostra um placeholder discreto
  if (!user) {
    return <div className="ml-4 h-9 w-24 rounded-full bg-neutral-900 animate-pulse" />;
  }

  const initials = getInitials(user);
  const firstName = getFirstName(user);

  return (
    <div className="relative ml-2 shrink-0" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={t('nav.menu')}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-neutral-800 transition-colors"
      >
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt={firstName} size="sm" />
        <span className="hidden 2xl:inline max-w-[10rem] truncate text-sm font-medium text-neutral-200">
          {t('nav.hello', { name: firstName })}
        </span>
      </button>

      {mounted && (
        <div id={menuId} data-state={state} className="motion-dropdown data-[state=closed]:opacity-0 data-[state=closed]:scale-[0.99] data-[state=closed]:duration-[var(--duration-quick)] data-[state=closed]:pointer-events-none origin-top-right absolute right-0 mt-2 w-max min-w-48 max-w-[min(30rem,calc(100vw-1rem))] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl z-50">
          <div className="gap-x-2 p-2 sm:columns-2">
            {GROUPS.map((group) => {
              const headingId = `user-menu-${group.section}`;
              return (
                <section key={group.section} aria-labelledby={headingId} className="mb-2 break-inside-avoid">
                  <p id={headingId} className="px-3 pb-1 pt-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {t(SECTION_LABEL_KEY[group.section])}
                  </p>
                  {group.items.map((item) => {
                    const isCurrent = isNavActive(pathname, item.to);
                    return (
                      <PrefetchLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setIsOpen(false)}
                        aria-current={isCurrent ? 'page' : undefined}
                        className={`${ITEM_CLASS} ${isCurrent ? 'bg-neutral-800 text-white' : 'text-neutral-300'}`}
                      >
                        {t(item.labelKey)}
                      </PrefetchLink>
                    );
                  })}
                  {group.section === 'help' && (
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setIsFeedbackOpen(true);
                      }}
                      className={`${ITEM_CLASS} w-full text-left text-neutral-300`}
                    >
                      {t('feedback.open')}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2 w-full border-t border-neutral-800 text-left px-5 py-2.5 text-sm break-words text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            <LogoutIcon />
            {t('nav.logout')}
          </button>
        </div>
      )}
      {isFeedbackOpen && (
        <Suspense fallback={null}>
          <FeedbackModal isOpen onClose={() => setIsFeedbackOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
