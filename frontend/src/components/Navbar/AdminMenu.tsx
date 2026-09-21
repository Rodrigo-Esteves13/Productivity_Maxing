import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldIcon, ChevronDownIcon } from '../UI/Icons';

interface AdminMenuProps {
  currentPath: string;
}

interface AdminLink {
  to: string;
  label: string;
}

// Os 4 links de admin eram renderizados soltos na Navbar, cada um com o
// mesmo bloco de classes amarelas repetido - juntos aqui, com o mesmo
// padrão de dropdown que o UserMenu já usa (ref + click-outside), isto
// deixa de comer largura fixa na barra principal e passa a ser um único
// trigger, tal como o resto do menu (mesma altura, mesmo espaçamento).
const ADMIN_LINKS: AdminLink[] = [
  { to: '/areas', label: 'Areas' },
  { to: '/users', label: 'Users' },
  { to: '/task-types', label: 'Task Types' },
  { to: '/security', label: 'Security' },
];

export default function AdminMenu({ currentPath }: AdminMenuProps) {
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
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${
          isAnyActive
            ? 'text-amber-400 bg-amber-400/10'
            : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
        }`}
      >
        <ShieldIcon className="h-4 w-4" />
        Admin
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-2 w-44 rounded-lg border border-neutral-800 bg-neutral-900 py-1 shadow-2xl z-50"
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
                className={`block px-4 py-2 text-sm font-semibold transition-colors ${
                  isActive
                    ? 'text-amber-400 bg-amber-400/10'
                    : 'text-amber-500/70 hover:text-amber-400 hover:bg-neutral-800'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
