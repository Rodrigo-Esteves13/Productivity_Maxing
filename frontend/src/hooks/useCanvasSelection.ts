import { useCallback, useMemo, useRef, useState } from 'react';
import type { UseDrawingCanvasResult } from './useDrawingCanvas';
import type { UseCanvasShapesResult } from './useCanvasShapes';
import type { UseCanvasLinksResult } from './useCanvasLinks';
import type { UseCanvasTextsResult } from './useCanvasTexts';
import {
  copySelection,
  EMPTY_SELECTION,
  getCanvasClipboard,
  isSelectionEmpty,
  offsetClipboard,
  PASTE_OFFSET,
  pointInRect,
  rectFromPoints,
  selectInRect,
  selectionBounds,
  setCanvasClipboard,
  type CanvasClipboard,
  type CanvasSelection,
  type Rect,
} from '../lib/canvasSelection';

interface UseCanvasSelectionParams {
  canvas: UseDrawingCanvasResult;
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  texts: UseCanvasTextsResult;
}

type Point = { x: number; y: number };

export interface UseCanvasSelectionResult {
  selection: CanvasSelection;
  hasSelection: boolean;
  bounds: Rect | null;
  marquee: Rect | null;
  canPaste: boolean;
  /** Pointer down with the Select tool: drag inside the selection moves it, elsewhere starts a box. */
  start: (point: Point) => void;
  move: (point: Point) => void;
  end: () => void;
  clear: () => void;
  copy: () => void;
  paste: () => void;
  duplicate: () => void;
  removeSelected: () => void;
}

// Ferramenta "Selecionar" do quadro: caixa de selecao, mover, copiar,
// colar, duplicar e apagar varios elementos de uma vez.
export function useCanvasSelection({ canvas, shapes, links, texts }: UseCanvasSelectionParams): UseCanvasSelectionResult {
  const [selection, setSelection] = useState<CanvasSelection>(EMPTY_SELECTION);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [canPaste, setCanPaste] = useState(() => getCanvasClipboard() !== null);
  const anchorRef = useRef<Point | null>(null);
  const dragRef = useRef<Point | null>(null);
  // Quantas vezes se colou o mesmo conteudo: cada colagem desce mais um pouco.
  const pasteCountRef = useRef(0);

  const content = useMemo(
    () => ({ strokes: canvas.strokes, shapes: shapes.shapes, links: links.links, texts: texts.texts }),
    [canvas.strokes, shapes.shapes, links.links, texts.texts],
  );
  const bounds = useMemo(() => selectionBounds(selection, content), [selection, content]);

  const clear = useCallback(() => setSelection(EMPTY_SELECTION), []);

  const start = useCallback(
    (point: Point) => {
      if (bounds && pointInRect(point, bounds)) {
        dragRef.current = point;
        return;
      }
      anchorRef.current = point;
      setMarquee(rectFromPoints(point, point));
      setSelection(EMPTY_SELECTION);
    },
    [bounds],
  );

  const move = useCallback(
    (point: Point) => {
      if (dragRef.current) {
        const dx = point.x - dragRef.current.x;
        const dy = point.y - dragRef.current.y;
        dragRef.current = point;
        canvas.translateStrokes(selection.strokes, dx, dy);
        shapes.translateShapes(selection.shapes, dx, dy);
        texts.translateTexts(selection.texts, dx, dy);
        return;
      }
      if (anchorRef.current) setMarquee(rectFromPoints(anchorRef.current, point));
    },
    [canvas, shapes, texts, selection],
  );

  const end = useCallback(() => {
    dragRef.current = null;
    if (anchorRef.current && marquee) setSelection(selectInRect(marquee, content));
    anchorRef.current = null;
    setMarquee(null);
  }, [marquee, content]);

  // Acrescenta uma copia e passa a ser ela a selecao (para a arrastar logo).
  const insert = useCallback(
    (clipboard: CanvasClipboard) => {
      const placed = offsetClipboard(clipboard, PASTE_OFFSET * pasteCountRef.current, PASTE_OFFSET * pasteCountRef.current);
      const firstStroke = canvas.strokes.length;
      canvas.addStrokes(placed.strokes);
      shapes.addShapes(placed.shapes);
      links.addLinks(placed.links);
      texts.addTexts(placed.texts);
      setSelection({
        strokes: placed.strokes.map((_, i) => firstStroke + i),
        shapes: placed.shapes.map((s) => s.id),
        texts: placed.texts.map((t) => t.id),
      });
    },
    [canvas, shapes, links, texts],
  );

  const copy = useCallback(() => {
    if (isSelectionEmpty(selection)) return;
    setCanvasClipboard(copySelection(selection, content));
    pasteCountRef.current = 1;
    setCanPaste(true);
  }, [selection, content]);

  const paste = useCallback(() => {
    const clipboard = getCanvasClipboard();
    if (!clipboard) return;
    insert(clipboard);
    pasteCountRef.current += 1;
  }, [insert]);

  const duplicate = useCallback(() => {
    if (isSelectionEmpty(selection)) return;
    pasteCountRef.current = 1;
    insert(copySelection(selection, content));
  }, [selection, content, insert]);

  const removeSelected = useCallback(() => {
    if (isSelectionEmpty(selection)) return;
    canvas.removeStrokes(selection.strokes);
    links.removeLinksForShapes(selection.shapes);
    shapes.removeShapes(selection.shapes);
    texts.removeTexts(selection.texts);
    setSelection(EMPTY_SELECTION);
  }, [canvas, links, shapes, texts, selection]);

  return {
    selection,
    hasSelection: !isSelectionEmpty(selection),
    bounds,
    marquee,
    canPaste,
    start,
    move,
    end,
    clear,
    copy,
    paste,
    duplicate,
    removeSelected,
  };
}
