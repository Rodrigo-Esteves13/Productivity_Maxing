import { useCallback, useState } from 'react';
import type { CanvasTextItem } from '../types/models';

export interface UseCanvasTextsResult {
  texts: CanvasTextItem[];
  selectedId: string | null;
  editingId: string | null;
  selectText: (id: string | null) => void;
  /** Creates an empty text item at (x, y) and immediately opens it for editing. */
  addText: (x: number, y: number) => void;
  moveText: (id: string, x: number, y: number) => void;
  updateText: (id: string, text: string) => void;
  startEditing: (id: string) => void;
  /** Closes editing; an item left empty (nothing typed) is dropped instead of saved. */
  stopEditing: () => void;
  removeText: (id: string) => void;
}

/**
 * Etiquetas de texto livre no canvas - ver comentário em CanvasTextItem
 * (types/models.ts). Criar uma entra logo em edição (addText já chama
 * startEditing); se o utilizador sair sem escrever nada, stopEditing
 * descarta o item em vez de guardar uma etiqueta vazia.
 */
export function useCanvasTexts(initialTexts: CanvasTextItem[] = []): UseCanvasTextsResult {
  const [texts, setTexts] = useState<CanvasTextItem[]>(initialTexts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const addText = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    setTexts((prev) => [...prev, { id, x, y, text: '' }]);
    setSelectedId(id);
    setEditingId(id);
  }, []);

  const moveText = useCallback((id: string, x: number, y: number) => {
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, x, y } : item)));
  }, []);

  const updateText = useCallback((id: string, text: string) => {
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }, []);

  const startEditing = useCallback((id: string) => {
    setEditingId(id);
    setSelectedId(id);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingId((currentId) => {
      if (currentId) {
        setTexts((prev) => prev.filter((item) => item.id !== currentId || item.text.trim().length > 0));
      }
      return null;
    });
  }, []);

  const removeText = useCallback((id: string) => {
    setTexts((prev) => prev.filter((item) => item.id !== id));
    setSelectedId((current) => (current === id ? null : current));
    setEditingId((current) => (current === id ? null : current));
  }, []);

  return {
    texts,
    selectedId,
    editingId,
    selectText: setSelectedId,
    addText,
    moveText,
    updateText,
    startEditing,
    stopEditing,
    removeText,
  };
}
