import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldIcon, ChevronDownIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface AdminMenuProps {
  currentPath: string;
}

interface AdminLink {
  to: string;
  labelKey: string;
}

// Os 4 links de admin eram renderizados soltos na Navbar, cada um com o
// mesmo bloco de classes amarelas repetido - juntos aqui, com o mesmo
// padrão de dropdown que o UserMenu já usa (ref + click-outside), isto
// deixa de comer largura fixa na barra principal e passa a ser um único
// trigger, tal como o resto do menu (mesma altura, mesmo espaçamento).
const ADMIN_LINKS: AdminLink[] = [
  { to: '/users', labelKey: 'nav.admin.users' },
  { to: '/task-types', labelKey: 'nav.admin.taskTypes' },
  { to: '/security', labelKey: 'nav.admin.security' },
  { to: '/appeals', labelKey: 'nav.admin.appeals' },
  { to: '/feedback', labelKey: 'nav.admin.feedback' },
];

export default function AdminMenu({ currentPath }: AdminMenuProps) {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isAnyActive = ADMIN_LINKS.some((link) => currentPath.startsWith(link.to));

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

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
          isAnyActive
            ? 'text-amber-400 bg-amber-400/10'
            : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
        }`}
      >
        <ShieldIcon className="h-4 w-4" />
        {t('nav.admin')}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-max min-w-44 max-w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-2xl z-50"
        >
          {ADMIN_LINKS.map((link) => {
            const isActive = currentPath.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                aria-current={isActive ? 'page' : undefined}
                className={`block px-4 py-2.5 text-sm font-semibold break-words transition-colors ${
                  isActive
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
                }`}
              >
                {t(link.labelKey)}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
