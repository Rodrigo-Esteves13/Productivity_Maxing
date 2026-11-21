import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasShortcutsOffZone, shouldIgnoreShortcut } from '../lib/shortcutGuards';
import { advanceSequence, HELP_KEY, INITIAL_SEQUENCE, type SequenceState } from '../lib/shortcutSequence';

// "?" abre a ajuda de atalhos; "g" + letra navega. Ignorado com modificadores,
// a escrever num campo, com um modal aberto ou num ecra com teclado proprio
// (data-shortcuts-off). Ouve na fase de captura: assim "g n" e consumido aqui
// e os atalhos da pagina (ex: "n" na Tasks) nao disparam em simultaneo.
export function usePaletteShortcuts(enabled: boolean, onHelp: () => void) {
  const navigate = useNavigate();
  const helpRef = useRef(onHelp);
  useEffect(() => {
    helpRef.current = onHelp;
  }, [onHelp]);

  useEffect(() => {
    if (!enabled) return;
    let state: SequenceState = INITIAL_SEQUENCE;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e, document) || hasShortcutsOffZone(document)) {
        state = INITIAL_SEQUENCE;
        return;
      }
      if (e.key === HELP_KEY) {
        e.preventDefault();
        state = INITIAL_SEQUENCE;
        helpRef.current();
        return;
      }
      if (e.key.length !== 1) return;
      const result = advanceSequence(state, e.key.toLowerCase(), Date.now());
      state = result.state;
      if (result.consumed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
      if (result.path) navigate(result.path);
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, navigate]);
}
