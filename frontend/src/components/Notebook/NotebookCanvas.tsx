import { useState } from 'react';
import type { UseDrawingCanvasResult } from '../../hooks/useDrawingCanvas';
import type { UseCanvasShapesResult } from '../../hooks/useCanvasShapes';
import type { UseCanvasLinksResult } from '../../hooks/useCanvasLinks';
import type { UseCanvasTextsResult } from '../../hooks/useCanvasTexts';
import { useCanvasInteraction } from '../../hooks/useCanvasInteraction';
import NotebookShapeNode from './NotebookShapeNode';
import NotebookTextNode from './NotebookTextNode';
import CanvasDrawToolbar from './canvas/CanvasDrawToolbar';
import CanvasShapesToolbar from './canvas/CanvasShapesToolbar';
import CanvasStrokesLayer from './canvas/CanvasStrokesLayer';
import CanvasLinksLayer from './canvas/CanvasLinksLayer';
import TextEditOverlay from './canvas/TextEditOverlay';
import { CANVAS_PAPER_COLOR, DEFAULT_VIEW_HEIGHT, MAX_VIEW_HEIGHT, VIEW_WIDTH } from './canvas/canvasConstants';
import type { DrawTool } from './canvas/canvasConstants';

interface NotebookCanvasProps {
  canvas: UseDrawingCanvasResult;
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  texts: UseCanvasTextsResult;
  // Desativa a captura de pointer events sem esconder o desenho já feito -
  // usado quando a entrada está só a ser vista, não editada.
  readOnly?: boolean;
  // Altura do viewBox (largura fica sempre em VIEW_WIDTH) - default
  // DEFAULT_VIEW_HEIGHT quando a entrada ainda não tem canvasHeight
  // guardado. Ver NotebookEntry.canvasHeight no schema.
  canvasHeight?: number;
  // Presente só quando editável - mostra o botão "Add more space" que
  // aumenta canvasHeight em GROW_STEP, até MAX_VIEW_HEIGHT. Resolve o
  // "fiquei sem espaço a meio da aula" sem mexer no modelo de dados.
  onGrowCanvas?: () => void;
}

function cursorClassFor(tool: DrawTool, readOnly: boolean): string {
  if (readOnly) return '';
  if (tool === 'eraser') return 'touch-none cursor-cell';
  if (tool === 'text') return 'touch-none cursor-text';
  return 'touch-none cursor-crosshair';
}

export default function NotebookCanvas({
  canvas,
  shapes,
  links,
  texts,
  readOnly = false,
  canvasHeight,
  onGrowCanvas,
}: NotebookCanvasProps) {
  const viewHeight = canvasHeight ?? DEFAULT_VIEW_HEIGHT;
  const [tool, setTool] = useState<DrawTool>('pen');

  const { svgRef, toSvgPoint, selectedShape, selectedLink, selectedText, deleteSelectedShape, svgHandlers } =
    useCanvasInteraction({ canvas, shapes, links, texts, tool, readOnly, viewHeight });

  const shapesById = new Map(shapes.shapes.map((shape) => [shape.id, shape]));
  const editingText = texts.texts.find((item) => item.id === texts.editingId) ?? null;

  return (
    <div className="space-y-2">
      {!readOnly && (
        <>
          <CanvasDrawToolbar canvas={canvas} texts={texts} selectedText={selectedText} tool={tool} onToolChange={setTool} />
          <CanvasShapesToolbar
            shapes={shapes}
            links={links}
            selectedShape={selectedShape}
            selectedLink={selectedLink}
            onDeleteSelectedShape={deleteSelectedShape}
          />
        </>
      )}

      {/* Fundo tipo papel de propósito, não o Nightshade escuro do resto
          da app - é uma superfície de escrita, não um painel de UI, e
          tinta preta (o default de quase todos) só é visível assim.
          "relative" aqui é o que permite ao input de edição de texto
          posicionar-se exatamente por cima do sítio certo. */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${viewHeight}`}
          // Focável só quando editável - é o que faz o Delete/Backspace do
          // teclado apagar a forma/ligação/texto selecionado sem
          // interferir com nenhum input fora do canvas.
          tabIndex={readOnly ? undefined : 0}
          style={{ backgroundColor: CANVAS_PAPER_COLOR }}
          className={`w-full rounded-lg border border-neutral-800 outline-none ${cursorClassFor(tool, readOnly)}`}
          {...svgHandlers}
        >
          <CanvasStrokesLayer strokes={canvas.strokes} currentStroke={canvas.currentStroke} />
          <CanvasLinksLayer links={links} shapesById={shapesById} readOnly={readOnly} />

          {shapes.shapes.map((shape) => (
            <NotebookShapeNode
              key={shape.id}
              shape={shape}
              isSelected={shape.id === shapes.selectedId}
              readOnly={readOnly}
              connectMode={links.connectMode}
              isLinkSource={shape.id === links.pendingSourceId}
              toSvgPoint={toSvgPoint}
              onSelect={() => shapes.selectShape(shape.id)}
              onMove={(x, y) => shapes.moveShape(shape.id, x, y)}
              onResize={(width, height) => shapes.resizeShape(shape.id, width, height)}
              onLinkClick={() => links.handleShapeClick(shape.id)}
            />
          ))}

          {texts.texts.map((item) => (
            <NotebookTextNode
              key={item.id}
              item={item}
              isSelected={item.id === texts.selectedId}
              isEditing={item.id === texts.editingId}
              readOnly={readOnly}
              toSvgPoint={toSvgPoint}
              onSelect={() => texts.selectText(item.id)}
              onMove={(x, y) => texts.moveText(item.id, x, y)}
              onStartEdit={() => texts.startEditing(item.id)}
            />
          ))}
        </svg>

        {editingText && (
          <TextEditOverlay
            key={editingText.id}
            item={editingText}
            svgRef={svgRef}
            onChangeText={(text) => texts.updateText(editingText.id, text)}
            onCommit={texts.stopEditing}
          />
        )}
      </div>

      {!readOnly && onGrowCanvas && (
        <button
          type="button"
          onClick={onGrowCanvas}
          disabled={viewHeight >= MAX_VIEW_HEIGHT}
          className="mt-2 w-full rounded-md border border-dashed border-neutral-700 py-1.5 text-xs font-medium text-neutral-400 hover:border-violet-500 hover:text-violet-400 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-neutral-700 disabled:hover:text-neutral-400"
        >
          {viewHeight >= MAX_VIEW_HEIGHT ? 'Maximum whiteboard size reached' : '+ Add more space'}
        </button>
      )}
    </div>
  );
}
