import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { UseDrawingCanvasResult } from '../../hooks/useDrawingCanvas';
import { strokeToPathData } from '../../utils/strokeToPath';
import { UndoIcon, TrashIcon } from '../UI/Icons';

interface NotebookCanvasProps {
  canvas: UseDrawingCanvasResult;
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

const COLOR_SWATCHES = ['#EDE9FE', '#F87171', '#FBBF24', '#34D399', '#60A5FA'];

export default function NotebookCanvas({ canvas, readOnly = false }: NotebookCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDrawingRef = useRef(false);

  const toSvgPoint = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW_WIDTH / rect.width;
    const scaleY = VIEW_HEIGHT / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure > 0 ? e.pressure : undefined,
    };
  }, []);

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly) return;
    const point = toSvgPoint(e);
    if (!point) return;
    isDrawingRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    canvas.startStroke(point);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (readOnly || !isDrawingRef.current) return;
    const point = toSvgPoint(e);
    if (!point) return;
    canvas.extendStroke(point);
  };

  const handlePointerUp = () => {
    if (readOnly) return;
    isDrawingRef.current = false;
    canvas.endStroke();
  };

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
                onClick={() => canvas.setColor(swatch)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  canvas.color === swatch
                    ? 'scale-110 border-white'
                    : 'border-transparent'
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

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className={`w-full rounded-lg border border-neutral-800 bg-neutral-950 ${
          readOnly ? '' : 'touch-none cursor-crosshair'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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
      </svg>
    </div>
  );
}
