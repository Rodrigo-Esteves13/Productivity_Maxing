import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { User } from '../../types/models';
import { LogoutIcon } from '../UI/Icons';
import Avatar from '../Profile/Avatar';

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha o menu ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Ainda a carregar os dados reais do user: mostra um placeholder discreto
  if (!user) {
    return <div className="ml-4 h-9 w-24 rounded-full bg-neutral-900 animate-pulse" />;
  }

  const initials = getInitials(user);
  const firstName = getFirstName(user);

  return (
    <div className="relative ml-4" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-neutral-800 transition-colors focus:outline-none"
      >
        <Avatar initials={initials} avatarUrl={user.avatarUrl} alt={firstName} size="sm" />
        <span className="hidden sm:inline text-sm font-medium text-neutral-200">
          Hello, {firstName}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-neutral-900 border border-neutral-800 rounded-lg shadow-2xl py-1 z-50">
          <Link
            to="/profile"
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors"
          >
            Profile
          </Link>
          <button
            onClick={() => {
              setIsOpen(false);
              onLogout();
            }}
            className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors"
          >
            <LogoutIcon />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
