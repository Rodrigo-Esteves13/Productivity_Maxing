import { useCallback, useState } from 'react';
import type { CanvasLink } from '../types/models';

export interface UseCanvasLinksResult {
  links: CanvasLink[];
  connectMode: boolean;
  /** The shape picked as the link's starting point, while waiting for the second click. */
  pendingSourceId: string | null;
  selectedLinkId: string | null;
  toggleConnectMode: () => void;
  /** Call with a shape's id when it's clicked while connectMode is on. */
  handleShapeClick: (shapeId: string) => void;
  /** Clears a pending first-click without leaving connectMode - used when the canvas background is clicked. */
  cancelPending: () => void;
  selectLink: (id: string | null) => void;
  relabelLink: (id: string, label: string) => void;
  removeLink: (id: string) => void;
  /** Drops every link touching a shape that's about to be deleted. */
  removeLinksForShape: (shapeId: string) => void;
}

/**
 * Estado das ligações entre formas do canvas - ver comentário em
 * CanvasLink (types/models.ts) sobre porque não tem coordenadas
 * próprias. Fluxo de criação é de dois cliques (não arrastar um fio):
 * connectMode ligado -> clica na forma A (fica pendingSourceId) -> clica
 * na forma B -> cria a ligação A->B e limpa pendingSourceId, mantendo
 * connectMode ligado para encadear mais ligações sem reabrir o modo.
 */
export function useCanvasLinks(initialLinks: CanvasLink[] = []): UseCanvasLinksResult {
  const [links, setLinks] = useState<CanvasLink[]>(initialLinks);
  const [connectMode, setConnectMode] = useState(false);
  const [pendingSourceId, setPendingSourceId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  const toggleConnectMode = useCallback(() => {
    setConnectMode((prev) => !prev);
    setPendingSourceId(null);
  }, []);

  const cancelPending = useCallback(() => {
    setPendingSourceId(null);
  }, []);

  const handleShapeClick = useCallback(
    (shapeId: string) => {
      if (!connectMode) return;

      setPendingSourceId((currentSource) => {
        if (!currentSource) return shapeId;
        if (currentSource === shapeId) return currentSource; // clicked the same shape twice - ignore

        setLinks((prev) => {
          const alreadyLinked = prev.some(
            (link) =>
              (link.fromShapeId === currentSource && link.toShapeId === shapeId) ||
              (link.fromShapeId === shapeId && link.toShapeId === currentSource),
          );
          if (alreadyLinked) return prev;
          return [...prev, { id: crypto.randomUUID(), fromShapeId: currentSource, toShapeId: shapeId, label: '' }];
        });

        return null;
      });
    },
    [connectMode],
  );

  const relabelLink = useCallback((id: string, label: string) => {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, label } : link)));
  }, []);

  const removeLink = useCallback((id: string) => {
    setLinks((prev) => prev.filter((link) => link.id !== id));
    setSelectedLinkId((current) => (current === id ? null : current));
  }, []);

  const removeLinksForShape = useCallback((shapeId: string) => {
    setLinks((prev) => prev.filter((link) => link.fromShapeId !== shapeId && link.toShapeId !== shapeId));
  }, []);

  return {
    links,
    connectMode,
    pendingSourceId,
    selectedLinkId,
    toggleConnectMode,
    handleShapeClick,
    cancelPending,
    selectLink: setSelectedLinkId,
    relabelLink,
    removeLink,
    removeLinksForShape,
  };
}
