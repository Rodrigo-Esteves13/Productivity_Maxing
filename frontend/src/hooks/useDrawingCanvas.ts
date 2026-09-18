import { useCallback, useRef, useState } from 'react';
import type { Stroke, StrokePoint } from '../types/models';

export interface UseDrawingCanvasResult {
  strokes: Stroke[];
  currentStroke: Stroke | null;
  color: string;
  setColor: (color: string) => void;
  width: number;
  setWidth: (width: number) => void;
  startStroke: (point: StrokePoint) => void;
  extendStroke: (point: StrokePoint) => void;
  endStroke: () => void;
  undo: () => void;
  clear: () => void;
  canUndo: boolean;
}

const DEFAULT_COLOR = '#EDE9FE'; // violeta claro sobre o fundo escuro do Nightshade
const DEFAULT_WIDTH = 2.5;

/**
 * Captura de traços vetoriais para o caderno (ver NotebookEntry.drawingStrokes
 * no schema.prisma para o "porquê" de vetorial em vez de rasterizado). Este
 * hook só guarda estado e regras (um traço de cada vez, undo por stroke
 * inteiro) - o componente <NotebookCanvas> é que traduz pointer events daqui
 * para SVG, mantendo os dois com responsabilidade única.
 */
export function useDrawingCanvas(initialStrokes: Stroke[] = []): UseDrawingCanvasResult {
  const [strokes, setStrokes] = useState<Stroke[]>(initialStrokes);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  // Guardado à parte do estado (não precisa de re-render por ponto
  // adicionado durante o traço) - só o SVG em construção lê isto a cada
  // frame via currentStroke.
  const activeRef = useRef<Stroke | null>(null);

  const startStroke = useCallback(
    (point: StrokePoint) => {
      const stroke: Stroke = { points: [point], color, width };
      activeRef.current = stroke;
      setCurrentStroke(stroke);
    },
    [color, width],
  );

  const extendStroke = useCallback((point: StrokePoint) => {
    if (!activeRef.current) return;
    activeRef.current = {
      ...activeRef.current,
      points: [...activeRef.current.points, point],
    };
    setCurrentStroke(activeRef.current);
  }, []);

  const endStroke = useCallback(() => {
    if (!activeRef.current || activeRef.current.points.length < 2) {
      activeRef.current = null;
      setCurrentStroke(null);
      return;
    }
    setStrokes((prev) => [...prev, activeRef.current as Stroke]);
    activeRef.current = null;
    setCurrentStroke(null);
  }, []);

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStrokes([]);
    activeRef.current = null;
    setCurrentStroke(null);
  }, []);

  return {
    strokes,
    currentStroke,
    color,
    setColor,
    width,
    setWidth,
    startStroke,
    extendStroke,
    endStroke,
    undo,
    clear,
    canUndo: strokes.length > 0,
  };
}
