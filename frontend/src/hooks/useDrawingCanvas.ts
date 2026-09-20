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
  eraseNear: (point: StrokePoint) => void;
  undo: () => void;
  clear: () => void;
  canUndo: boolean;
}

// Preto por default - é o que a maioria escreve à mão num papel real (ver
// pedido do utilizador). O canvas tem fundo tipo papel (ver NotebookCanvas),
// não o Nightshade escuro do resto da app, por isso preto aqui é visível
// desde a primeira pincelada, ao contrário do tema anterior.
const DEFAULT_COLOR = '#1C1C1E';
const DEFAULT_WIDTH = 2.5;

// Distância (nas coordenadas fixas do viewBox, ver NotebookCanvas) a que o
// apagador ainda conta como "a tocar" num traço - dá alguma margem em vez
// de exigir acertar exatamente em cima de um pixel do traço.
const ERASE_RADIUS = 14;

function distance(a: StrokePoint, b: StrokePoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function strokeIsNear(stroke: Stroke, point: StrokePoint): boolean {
  return stroke.points.some((p) => distance(p, point) <= ERASE_RADIUS);
}

/**
 * Captura de traços vetoriais para o caderno (ver NotebookEntry.drawingStrokes
 * no schema.prisma para o "porquê" de vetorial em vez de rasterizado). Este
 * hook só guarda estado e regras (um traço de cada vez, apagar por traço
 * inteiro, undo) - o componente <NotebookCanvas> é que traduz pointer events
 * daqui para SVG, mantendo os dois com responsabilidade única.
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
    // Captura o traço ANTES de mexer no ref. O updater passado a
    // setStrokes só corre depois desta função terminar (o React só o
    // invoca na fase de commit) - se ele lesse activeRef.current
    // diretamente, já apanhava null (posto na linha a seguir), porque o
    // JS síncrono acaba de correr primeiro. Era exatamente isto que
    // rebentava o NotebookCanvas com "null has no properties" ao soltar
    // o rato.
    const finishedStroke = activeRef.current;
    activeRef.current = null;
    setCurrentStroke(null);

    if (!finishedStroke || finishedStroke.points.length < 2) return;
    setStrokes((prev) => [...prev, finishedStroke]);
  }, []);

  // Apaga o traço inteiro que passar perto do ponto, não s(pixel a pixel)
  // - mais previsível de usar com rato do que um apagador de precisão, e
  // muito mais simples de guardar/reabrir do que "buracos" dentro de um
  // traço vetorial.
  const eraseNear = useCallback((point: StrokePoint) => {
    setStrokes((prev) => prev.filter((stroke) => !strokeIsNear(stroke, point)));
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
    eraseNear,
    undo,
    clear,
    canUndo: strokes.length > 0,
  };
}
