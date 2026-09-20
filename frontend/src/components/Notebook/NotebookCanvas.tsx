import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react';
import type { UseDrawingCanvasResult } from '../../hooks/useDrawingCanvas';
import type { UseCanvasShapesResult } from '../../hooks/useCanvasShapes';
import type { UseCanvasLinksResult } from '../../hooks/useCanvasLinks';
import type { UseCanvasTextsResult } from '../../hooks/useCanvasTexts';
import { strokeToPathData } from '../../utils/strokeToPath';
import { CANVAS_SHAPE_DEFS } from './canvasShapeDefs';
import { computeLinkEndpoints } from './canvasGeometry';
import NotebookShapeNode from './NotebookShapeNode';
import type { SvgPoint } from './NotebookShapeNode';
import NotebookTextNode from './NotebookTextNode';
import { UndoIcon, TrashIcon, EraserIcon, PencilIcon, XIcon, LinkIcon, TypeIcon } from '../UI/Icons';

type DrawTool = 'pen' | 'eraser' | 'text';

interface NotebookCanvasProps {
  canvas: UseDrawingCanvasResult;
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  texts: UseCanvasTextsResult;
  // Desativa a captura de pointer events sem esconder o desenho já feito -
  // usado quando a entrada está só a ser vista, não editada.
  readOnly?: boolean;
}

// viewBox fixo: os traços guardados na BD ficam sempre nestas coordenadas,
// independentemente do tamanho do ecrã em que foram desenhados - o SVG
// escala visualmente via width/height CSS, mas as coordenadas internas
// (e portanto o que vai para a API) nunca mudam com o viewport.
const VIEW_WIDTH = 800;
const VIEW_HEIGHT = 500;

// Preto/cinza-escuro primeiro (é o que a maioria usa por default num
// papel real), depois um punhado de cores para destacar - nada de "tema
// Nightshade" aqui, o canvas é propositadamente uma superfície à parte.
const COLOR_SWATCHES = [
  '#1C1C1E', // preto
  '#44403C', // cinza-escuro
  '#B91C1C', // vermelho
  '#1D4ED8', // azul
  '#15803D', // verde
  '#B45309', // laranja/castanho
  '#7C3AED', // violeta (accent da app, para quem quiser continuar a usá-lo)
];

export default function NotebookCanvas({ canvas, shapes, links, texts, readOnly = false }: NotebookCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawingRef = useRef(false);
  const [tool, setTool] = useState<DrawTool>('pen');

  const toSvgPoint = useCallback((e: ReactPointerEvent<SVGElement>): SvgPoint | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_WIDTH / rect.width;
    const scaleY = VIEW_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const toStrokePoint = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const point = toSvgPoint(e);
      if (!point) return null;
      return { ...point, pressure: e.pressure > 0 ? e.pressure : undefined };
    },
    [toSvgPoint],
  );

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
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
      // prestes a aparecer, não para o canvas. Ver também
      // onPointerDownCapture mais abaixo, que evita o mesmo problema
      // vindo do lado do nosso próprio JS.
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

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || !isDrawingRef.current) return;
    const point = toStrokePoint(e);
    if (!point) return;
    if (tool === 'eraser') {
      canvas.eraseNear(point);
    } else {
      canvas.extendStroke(point);
    }
  };

  const handlePointerUp = () => {
    if (readOnly) return;
    const wasDrawing = isDrawingRef.current;
    isDrawingRef.current = false;
    if (wasDrawing && tool !== 'eraser') canvas.endStroke();
  };

  const selectedShape = shapes.shapes.find((shape) => shape.id === shapes.selectedId) ?? null;
  const selectedLink = links.links.find((link) => link.id === links.selectedLinkId) ?? null;
  const shapesById = new Map(shapes.shapes.map((shape) => [shape.id, shape]));

  const handleDeleteSelectedShape = () => {
    if (!selectedShape) return;
    links.removeLinksForShape(selectedShape.id);
    shapes.removeShape(selectedShape.id);
  };

  // Delete/Backspace apaga o que estiver selecionado - só ativo quando o
  // <svg> tem foco (ver tabIndex + onPointerDownCapture abaixo), por
  // isso nunca interfere com escrever num input noutro sítio da página
  // (o overlay de edição de texto abaixo trava a tecla com
  // stopPropagation antes de chegar aqui).
  const handleKeyDown = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (readOnly) return;
    if (e.key !== 'Delete' && e.key !== 'Backspace') return;
    if (selectedShape) {
      handleDeleteSelectedShape();
    } else if (selectedLink) {
      links.removeLink(selectedLink.id);
    } else if (texts.selectedId) {
      texts.removeText(texts.selectedId);
    }
  };

  const editingText = texts.texts.find((item) => item.id === texts.editingId) ?? null;

  return (
    <div className="space-y-2">
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2">
          <div className="flex items-center gap-1.5">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use color ${swatch}`}
                onClick={() => {
                  canvas.setColor(swatch);
                  setTool('pen');
                }}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  tool === 'pen' && canvas.color === swatch
                    ? 'scale-110 border-violet-400'
                    : 'border-neutral-700'
                }`}
                style={{ backgroundColor: swatch }}
              />
            ))}
          </div>

          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={canvas.width}
            onChange={(e) => canvas.setWidth(Number(e.target.value))}
            className="w-24 accent-violet-500"
            aria-label="Stroke width"
          />

          <div className="flex items-center rounded-md border border-neutral-800 bg-neutral-950 p-0.5">
            <button
              type="button"
              onClick={() => setTool('pen')}
              aria-pressed={tool === 'pen'}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                tool === 'pen' ? 'bg-violet-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Draw
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              aria-pressed={tool === 'eraser'}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                tool === 'eraser' ? 'bg-violet-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <EraserIcon className="h-3.5 w-3.5" />
              Eraser
            </button>
            <button
              type="button"
              onClick={() => setTool('text')}
              aria-pressed={tool === 'text'}
              title="Click the whiteboard to type text"
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                tool === 'text' ? 'bg-violet-600 text-white' : 'text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              <TypeIcon className="h-3.5 w-3.5" />
              Text
            </button>
          </div>

          {texts.selectedId && !texts.editingId && (
            <button
              type="button"
              onClick={() => texts.removeText(texts.selectedId as string)}
              aria-label="Delete text"
              title="Delete (or press Delete/Backspace)"
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-neutral-800"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete text
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={canvas.undo}
              disabled={!canvas.canUndo}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-40"
            >
              <UndoIcon className="h-4 w-4" />
              Undo
            </button>
            <button
              type="button"
              onClick={canvas.clear}
              disabled={!canvas.canUndo}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-neutral-800 disabled:opacity-40"
            >
              <TrashIcon className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Segunda barra, à parte da de traço/apagador - são dois modelos
          diferentes (forma posicionável vs. pincelada), por isso os
          controlos ficam separados em vez de misturados na mesma linha. */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Shapes</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {CANVAS_SHAPE_DEFS.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => shapes.addShape(def.type)}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-medium text-neutral-200 hover:border-violet-500 hover:text-white"
              >
                {def.paletteLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={links.toggleConnectMode}
            aria-pressed={links.connectMode}
            title="Click two shapes to link them"
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              links.connectMode
                ? 'bg-blue-600 text-white'
                : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <LinkIcon className="h-3.5 w-3.5" />
            {links.connectMode
              ? links.pendingSourceId
                ? 'Click the 2nd shape...'
                : 'Click the 1st shape...'
              : 'Connect'}
          </button>

          {selectedShape && (
            <div className="ml-auto flex items-center gap-2">
              <input
                value={selectedShape.label}
                onChange={(e) => shapes.relabelShape(selectedShape.id, e.target.value)}
                placeholder="Label"
                maxLength={40}
                aria-label="Selected shape label"
                className="w-28 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleDeleteSelectedShape}
                aria-label="Delete shape"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-neutral-800"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => shapes.selectShape(null)}
                aria-label="Deselect shape"
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {!selectedShape && selectedLink && (
            <div className="ml-auto flex items-center gap-2">
              <input
                value={selectedLink.label}
                onChange={(e) => links.relabelLink(selectedLink.id, e.target.value)}
                placeholder="Link label (optional)"
                maxLength={40}
                aria-label="Selected link label"
                className="w-36 rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => links.removeLink(selectedLink.id)}
                aria-label="Delete link"
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-400 hover:bg-neutral-800"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                type="button"
                onClick={() => links.selectLink(null)}
                aria-label="Deselect link"
                className="rounded-md p-1 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Fundo tipo papel de propósito, não o Nightshade escuro do resto
          da app - é uma superfície de escrita, não um painel de UI, e
          tinta preta (o default de quase todos) só é visível assim.
          "relative" aqui é o que permite ao input de edição de texto
          (abaixo) posicionar-se exatamente por cima do sítio certo. */}
      <div className="relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          // Focável só quando editável - é o que faz o Delete/Backspace do
          // teclado apagar a forma/ligação/texto selecionado (ver
          // handleKeyDown) sem interferir com nenhum input fora do canvas.
          tabIndex={readOnly ? undefined : 0}
          className={`w-full rounded-lg border border-neutral-800 bg-[#F5F1E8] outline-none ${
            readOnly
              ? ''
              : tool === 'eraser'
                ? 'touch-none cursor-cell'
                : tool === 'text'
                  ? 'touch-none cursor-text'
                  : 'touch-none cursor-crosshair'
          }`}
          onPointerDownCapture={(e) => {
            // Exceção: um clique em área vazia com a ferramenta Text
            // ativa vai criar um <input> novo que precisa do foco para
            // já se poder escrever - focar o <svg> aqui competiria com
            // isso (é exatamente o que causava a caixa a falhar
            // intermitentemente). Em qualquer outro caso (clicar numa
            // forma/ligação/texto existente, ou em área vazia com
            // Draw/Eraser/Connect), o <svg> continua a ganhar o foco
            // normalmente, para o Delete do teclado funcionar.
            if (tool === 'text' && e.target === svgRef.current) return;
            svgRef.current?.focus();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onKeyDown={handleKeyDown}
        >
          {canvas.strokes.map((stroke, index) => (
            <path
              key={index}
              d={strokeToPathData(stroke)}
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ))}
          {canvas.currentStroke && (
            <path
              d={strokeToPathData(canvas.currentStroke)}
              stroke={canvas.currentStroke.color}
              strokeWidth={canvas.currentStroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          )}

          {/* Connect é só uma ligação (linha) entre duas formas, sem
              indicar direção - de propósito, sem arrowhead/marker. */}
          {links.links.map((link) => {
            const from = shapesById.get(link.fromShapeId);
            const to = shapesById.get(link.toShapeId);
            // Ligação órfã (a forma referenciada já não existe) - não há
            // nada válido para desenhar. Não deve acontecer na prática
            // (removeLinksForShape corre sempre que uma forma é apagada),
            // mas fica seguro perante dados antigos/editados por fora.
            if (!from || !to) return null;

            const { start, end } = computeLinkEndpoints(from, to);
            const isSelected = link.id === links.selectedLinkId;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            return (
              <g key={link.id}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={isSelected ? '#2563EB' : '#475569'}
                  strokeWidth={isSelected ? 3 : 2}
                  className={readOnly ? '' : 'cursor-pointer'}
                  onPointerDown={(e) => {
                    if (readOnly || links.connectMode) return;
                    e.stopPropagation();
                    links.selectLink(link.id);
                  }}
                />
                {link.label && (
                  <text
                    x={midX}
                    y={midY - 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#334155"
                    className="select-none"
                    style={{ paintOrder: 'stroke', stroke: '#F5F1E8', strokeWidth: 3 }}
                  >
                    {link.label}
                  </text>
                )}
              </g>
            );
          })}

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
    </div>
  );
}

interface TextEditOverlayProps {
  item: { x: number; y: number; text: string };
  svgRef: RefObject<SVGSVGElement | null>;
  onChangeText: (text: string) => void;
  onCommit: () => void;
}

// Um <input> HTML normal posicionado por cima do <svg> via CSS, não um
// <input> dentro de <foreignObject> - essa via não estava a aparecer de
// todo nalguns browsers, um overlay comum é muito mais previsível.
// Segue as coordenadas do viewBox fixo (VIEW_WIDTH/VIEW_HEIGHT) através
// do mesmo fator de escala que toSvgPoint usa ao contrário.
function TextEditOverlay({ item, svgRef, onChangeText, onCommit }: TextEditOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const rect = svgRef.current?.getBoundingClientRect();
  const scale = rect ? rect.width / VIEW_WIDTH : 1;

  // useEffect corre sempre depois do <input> estar montado no DOM (parte
  // do commit do React), ao contrário de autoFocus cujo timing exato
  // pode competir com o foco por omissão do browser no <svg> (tabIndex)
  // - era essa corrida que fazia a caixa falhar de vez em quando.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      value={item.text}
      onChange={(e) => onChangeText(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        // Não deixa o Delete/Backspace/Escape enquanto se escreve aqui
        // chegarem ao handler de teclado do canvas (que apagaria a
        // forma/ligação selecionada) - aqui servem só para editar texto.
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.currentTarget.blur();
        }
      }}
      placeholder="Type..."
      style={{
        position: 'absolute',
        left: item.x * scale,
        top: item.y * scale,
        width: 220 * scale,
        fontSize: 14 * scale,
        lineHeight: 1.3,
      }}
      className="rounded border border-violet-500 bg-white/95 px-1.5 py-1 text-neutral-900 outline-none"
    />
  );
}
