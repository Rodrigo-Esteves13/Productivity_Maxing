import { useCallback, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import type { UseDrawingCanvasResult } from './useDrawingCanvas';
import type { UseCanvasShapesResult } from './useCanvasShapes';
import type { UseCanvasLinksResult } from './useCanvasLinks';
import type { UseCanvasTextsResult } from './useCanvasTexts';
import { VIEW_WIDTH } from '../components/Notebook/canvas/canvasConstants';
import type { DrawTool } from '../components/Notebook/canvas/canvasConstants';
import type { SvgPoint } from '../components/Notebook/NotebookShapeNode';

interface UseCanvasInteractionParams {
  canvas: UseDrawingCanvasResult;
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  texts: UseCanvasTextsResult;
  tool: DrawTool;
  readOnly: boolean;
  viewHeight: number;
}

// Tudo o que e "reagir ao rato/caneta/teclado" no canvas: converter
// coordenadas do ecra para o viewBox, desenhar/apagar tracos, deselecionar
// e apagar com Delete. O NotebookCanvas so liga estes handlers ao <svg>.
export function useCanvasInteraction({
  canvas,
  shapes,
  links,
  texts,
  tool,
  readOnly,
  viewHeight,
}: UseCanvasInteractionParams) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawingRef = useRef(false);

  const toSvgPoint = useCallback(
    (e: ReactPointerEvent<SVGElement>): SvgPoint | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const rect = svg.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (VIEW_WIDTH / rect.width),
        y: (e.clientY - rect.top) * (viewHeight / rect.height),
      };
    },
    [viewHeight],
  );

  const toStrokePoint = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const point = toSvgPoint(e);
      if (!point) return null;
      return { ...point, pressure: e.pressure > 0 ? e.pressure : undefined };
    },
    [toSvgPoint],
  );

  const selectedShape = shapes.shapes.find((shape) => shape.id === shapes.selectedId) ?? null;
  const selectedLink = links.links.find((link) => link.id === links.selectedLinkId) ?? null;
  const selectedText = texts.texts.find((item) => item.id === texts.selectedId) ?? null;

  const deleteSelectedShape = () => {
    if (!selectedShape) return;
    links.removeLinksForShape(selectedShape.id);
    shapes.removeShape(selectedShape.id);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    // Chegar aqui (em vez de ter sido travado por stopPropagation numa
    // forma, ligação ou texto) significa que o clique foi em área vazia
    // do canvas - desseleciona tudo o que estiver ativo e cancela uma
    // ligação a meio de ser criada, se houver.
    shapes.selectShape(null);
    links.selectLink(null);
    links.cancelPending();
    texts.selectText(null);

    if (tool === 'text') {
      // Impede o foco por omissão do browser (ia para o <svg>, por ter
      // tabIndex) - queremos que o foco vá para o <input> que está
      // prestes a aparecer, não para o canvas.
      e.preventDefault();
      const point = toSvgPoint(e);
      if (point) texts.addText(point.x, point.y);
      return;
    }

    // Em modo Connect, um clique em área vazia serve só para cancelar
    // uma ligação a meio (acima) - não deve começar a desenhar um traço.
    if (links.connectMode) return;
    const point = toStrokePoint(e);
    if (!point) return;
    isDrawingRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      canvas.eraseNear(point);
    } else {
      canvas.startStroke(point);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || !isDrawingRef.current) return;
    const point = toStrokePoint(e);
    if (!point) return;
    if (tool === 'eraser') {
      canvas.eraseNear(point);
    } else {
      canvas.extendStroke(point);
    }
  };

  const onPointerUp = () => {
    if (readOnly) return;
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    if (wasDrawing && tool !== 'eraser') canvas.endStroke();
  };

  const onPointerDownCapture = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Exceção: um clique em área vazia com a ferramenta Text ativa vai
    // criar um <input> novo que precisa do foco para já se poder
    // escrever - focar o <svg> aqui competiria com isso.
    if (tool === 'text' && e.target === svgRef.current) return;
    // preventScroll: sem isto, o browser tenta trazer o <svg> (que pode
    // ser bem mais alto que o ecrã) inteiro para a vista sempre que
    // ganha foco - dava um scroll para baixo inesperado.
    svgRef.current?.focus({ preventScroll: true });
  };

  // Delete/Backspace apaga o que estiver selecionado - só ativo quando o
  // <svg> tem foco, por isso nunca interfere com escrever num input
  // noutro sítio da página.
  const onKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (selectedShape) {
      deleteSelectedShape();
    } else if (selectedLink) {
      links.removeLink(selectedLink.id);
    } else if (texts.selectedId) {
      texts.removeText(texts.selectedId);
    }
  };

  return {
    svgRef,
    toSvgPoint,
    selectedShape,
    selectedLink,
    selectedText,
    deleteSelectedShape,
    svgHandlers: { onPointerDownCapture, onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp, onKeyDown },
  };
}
