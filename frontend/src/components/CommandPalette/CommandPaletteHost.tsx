import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { canPrefetch, lazyWithPreload, whenIdle } from '../../lib/lazyWithPreload';
import { OPEN_SHORTCUTS_HELP_EVENT } from '../../lib/shortcutSequence';
import { usePaletteShortcuts } from '../../hooks/usePaletteShortcuts';
import { usePaletteShortcutsPref } from '../../hooks/usePaletteShortcutsPref';
import ShortcutsHelpModal from './ShortcutsHelpModal';

const CommandPalette = lazyWithPreload(() => import('./CommandPalette'));

export const OPEN_COMMAND_PALETTE_EVENT = 'pmaxing:open-command-palette';

const PALETTE_ROOT_SELECTOR = '[data-command-palette]';

function focusedOutsidePalette(): HTMLElement | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) return null;
  return active.closest(PALETTE_ROOT_SELECTOR) ? null : active;
}

// Parte leve da paleta, montada sempre: so o atalho e o evento de abrir.
// A paleta em si (pesquisa, quick add, notebook) vem num chunk proprio,
// pre-carregado no tempo livre para o primeiro Ctrl+K nao esperar. Depois
// de aberta uma vez fica montada, para guardar as tasks ja carregadas.
export default function CommandPaletteHost() {
  const { isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { enabled: shortcutsEnabled } = usePaletteShortcutsPref();
  // Elemento que tinha o foco antes de a paleta abrir: a ajuda aberta pelo
  // comando da paleta devolve-lhe o foco ao fechar (a paleta ja nao existe).
  const beforePaletteRef = useRef<HTMLElement | null>(null);
  const helpReturnFocusRef = useRef<HTMLElement | null>(null);
  const openHelp = useCallback(() => setIsHelpOpen(true), []);
  const openHelpFromPalette = useCallback(() => {
    helpReturnFocusRef.current = beforePaletteRef.current;
    setIsHelpOpen(true);
  }, []);
  const closeHelp = useCallback(() => {
    const target = helpReturnFocusRef.current;
    helpReturnFocusRef.current = null;
    setIsHelpOpen(false);
    if (target?.isConnected) target.focus();
  }, []);

  // "?" e "g" + letra: so com sessao iniciada e a preferencia ligada.
  usePaletteShortcuts(isAuthenticated && shortcutsEnabled, openHelp);

  // A entrada "Keyboard shortcuts" da paleta abre a ajuda por evento.
  useEffect(() => {
    if (!isAuthenticated) return;
    window.addEventListener(OPEN_SHORTCUTS_HELP_EVENT, openHelpFromPalette);
    return () => window.removeEventListener(OPEN_SHORTCUTS_HELP_EVENT, openHelpFromPalette);
  }, [isAuthenticated, openHelpFromPalette]);

  // Global Cmd/Ctrl+K to open, from anywhere in the app (not just when
  // something is already focused inside the palette). Escape to close is
  // handled separately inside the palette, only while open, same split
  // Modal.tsx uses.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        beforePaletteRef.current = focusedOutsidePalette();
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
      beforePaletteRef.current = focusedOutsidePalette();
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

  if (!isAuthenticated) return null;
  return (
    <>
      <ShortcutsHelpModal isOpen={isHelpOpen} onClose={closeHelp} />
      {isMounted && (
        <Suspense fallback={null}>
          <CommandPalette isOpen={isOpen} setIsOpen={setIsOpen} />
        </Suspense>
      )}
    </>
  );
}
