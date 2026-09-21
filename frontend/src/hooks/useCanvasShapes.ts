import { useCallback, useState } from 'react';
import type { CanvasShape, CanvasShapeType } from '../types/models';
import { getShapeDef } from '../components/Notebook/canvasShapeDefs';

export interface UseCanvasShapesResult {
  shapes: CanvasShape[];
  selectedId: string | null;
  selectShape: (id: string | null) => void;
  addShape: (type: CanvasShapeType) => void;
  moveShape: (id: string, x: number, y: number) => void;
  resizeShape: (id: string, width: number, height: number) => void;
  relabelShape: (id: string, label: string) => void;
  removeShape: (id: string) => void;
  clear: () => void;
}

// Espalha as novas formas em vez de as empilhar sempre no mesmo canto -
// cada shape nova fica um pouco mais abaixo/direita da anterior (o mesmo
// truque que qualquer editor de diagramas usa para "New shape" não cair
// sempre em cima da última).
const STAGGER_STEP = 24;
const MAX_STAGGER = 4;

/**
 * Estado do canvas shapes (router/switch/firewall/...) - guardado à
 * parte de useDrawingCanvas (traço à mão) de propósito: são dois modelos
 * de dados diferentes (posição/tamanho próprios vs. pontos de um traço
 * imutável), só partilham o mesmo <svg>/coordenadas no NotebookCanvas.
 */
export function useCanvasShapes(initialShapes: CanvasShape[] = []): UseCanvasShapesResult {
  const [shapes, setShapes] = useState<CanvasShape[]>(initialShapes);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const addShape = useCallback((type: CanvasShapeType) => {
    const def = getShapeDef(type);
    setShapes((prev) => {
      const stagger = Math.min(prev.length, MAX_STAGGER) * STAGGER_STEP;
      const newShape: CanvasShape = {
        id: crypto.randomUUID(),
        type,
        x: 40 + stagger,
        y: 40 + stagger,
        width: def.defaultWidth,
        height: def.defaultHeight,
        label: def.defaultLabel,
      };
      setSelectedId(newShape.id);
      return [...prev, newShape];
    });
  }, []);

  const moveShape = useCallback((id: string, x: number, y: number) => {
    setShapes((prev) => prev.map((shape) => (shape.id === id ? { ...shape, x, y } : shape)));
  }, []);

  const resizeShape = useCallback((id: string, width: number, height: number) => {
    setShapes((prev) =>
      prev.map((shape) =>
        shape.id === id
          ? { ...shape, width: Math.max(20, width), height: Math.max(20, height) }
          : shape,
      ),
    );
  }, []);

  const relabelShape = useCallback((id: string, label: string) => {
    setShapes((prev) => prev.map((shape) => (shape.id === id ? { ...shape, label } : shape)));
  }, []);

  const removeShape = useCallback((id: string) => {
    setShapes((prev) => prev.filter((shape) => shape.id !== id));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const clear = useCallback(() => {
    setShapes([]);
    setSelectedId(null);
  }, []);

  return {
    shapes,
    selectedId,
    selectShape: setSelectedId,
    addShape,
    moveShape,
    resizeShape,
    relabelShape,
    removeShape,
    clear,
  };
}
