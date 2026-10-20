import { Suspense, useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { canPrefetch, lazyWithPreload, whenIdle } from '../../lib/lazyWithPreload';

const CommandPalette = lazyWithPreload(() => import('./CommandPalette'));

export const OPEN_COMMAND_PALETTE_EVENT = 'pmaxing:open-command-palette';

// Parte leve da paleta, montada sempre: so o atalho e o evento de abrir.
// A paleta em si (pesquisa, quick add, notebook) vem num chunk proprio,
// pre-carregado no tempo livre para o primeiro Ctrl+K nao esperar. Depois
// de aberta uma vez fica montada, para guardar as tasks ja carregadas.
export default function CommandPaletteHost() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Global Cmd/Ctrl+K to open, from anywhere in the app (not just when
  // something is already focused inside the palette). Escape to close is
  // handled separately inside the palette, only while open, same split
  // Modal.tsx uses.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsMounted(true);
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated]);

  // Also opens on a plain DOM CustomEvent - lets the visible search button
  // in Navbar.tsx open the same palette without lifting isOpen state up
  // into a context just for one cross-component trigger. Anyone with
  // mouse-only usage (or who never learns the shortcut) still has a way
  // in - a keyboard-only entry point isn't discoverable on its own.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleOpenEvent = () => {
      setIsMounted(true);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handleOpenEvent);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !canPrefetch()) return;
    return whenIdle(() => void CommandPalette.preload().catch(() => undefined));
  }, [isAuthenticated]);

  if (!isAuthenticated || !isMounted) return null;
  return (
    <Suspense fallback={null}>
      <CommandPalette isOpen={isOpen} setIsOpen={setIsOpen} />
    </Suspense>
  );
}
