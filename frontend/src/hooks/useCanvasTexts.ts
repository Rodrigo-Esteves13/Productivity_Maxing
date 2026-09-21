import { useCallback, useRef, useState } from 'react';
import type { CanvasTextItem } from '../types/models';

export interface UseCanvasTextsResult {
  texts: CanvasTextItem[];
  selectedId: string | null;
  editingId: string | null;
  selectText: (id: string | null) => void;
  /** Creates an empty text item at (x, y), using the last-used size/color, and immediately opens it for editing. */
  addText: (x: number, y: number) => void;
  moveText: (id: string, x: number, y: number) => void;
  updateText: (id: string, text: string) => void;
  /** Also becomes the default for the next new text item. */
  setFontSize: (id: string, fontSize: number) => void;
  /** Also becomes the default for the next new text item. */
  setColor: (id: string, color: string) => void;
  startEditing: (id: string) => void;
  /** Closes editing; an item left empty (nothing typed) is dropped instead of saved. */
  stopEditing: () => void;
  removeText: (id: string) => void;
}

export const DEFAULT_TEXT_FONT_SIZE = 14;
export const DEFAULT_TEXT_COLOR = '#1C1C1E';

/**
 * Etiquetas de texto livre no canvas - ver comentário em CanvasTextItem
 * (types/models.ts). Criar uma entra logo em edição (addText já chama
 * startEditing); se o utilizador sair sem escrever nada, stopEditing
 * descarta o item em vez de guardar uma etiqueta vazia.
 *
 * fontSize/color de um novo texto começam no último tamanho/cor usados
 * nesta entrada (ou no default, se ainda não houver nenhum) - escrever
 * várias etiquetas seguidas não obriga a reajustar o estilo a cada uma.
 */
export function useCanvasTexts(initialTexts: CanvasTextItem[] = []): UseCanvasTextsResult {
  const [texts, setTexts] = useState<CanvasTextItem[]>(() =>
    initialTexts.map((item) => ({
      ...item,
      fontSize: item.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      color: item.color ?? DEFAULT_TEXT_COLOR,
    })),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const lastFontSizeRef = useRef(initialTexts.at(-1)?.fontSize ?? DEFAULT_TEXT_FONT_SIZE);
  const lastColorRef = useRef(initialTexts.at(-1)?.color ?? DEFAULT_TEXT_COLOR);

  const addText = useCallback((x: number, y: number) => {
    const id = crypto.randomUUID();
    setTexts((prev) => [
      ...prev,
      { id, x, y, text: '', fontSize: lastFontSizeRef.current, color: lastColorRef.current },
    ]);
    setSelectedId(id);
    setEditingId(id);
  }, []);

  const moveText = useCallback((id: string, x: number, y: number) => {
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, x, y } : item)));
  }, []);

  const updateText = useCallback((id: string, text: string) => {
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, text } : item)));
  }, []);

  const setFontSize = useCallback((id: string, fontSize: number) => {
    lastFontSizeRef.current = fontSize;
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, fontSize } : item)));
  }, []);

  const setColor = useCallback((id: string, color: string) => {
    lastColorRef.current = color;
    setTexts((prev) => prev.map((item) => (item.id === id ? { ...item, color } : item)));
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
    setFontSize,
    setColor,
    startEditing,
    stopEditing,
    removeText,
  };
}
