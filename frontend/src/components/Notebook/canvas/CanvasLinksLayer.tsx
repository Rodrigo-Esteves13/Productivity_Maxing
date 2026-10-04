import type { CanvasShape } from '../../../types/models';
import type { UseCanvasLinksResult } from '../../../hooks/useCanvasLinks';
import { computeLinkEndpoints } from '../canvasGeometry';
import { CANVAS_PAPER_COLOR } from './canvasConstants';

interface CanvasLinksLayerProps {
  links: UseCanvasLinksResult;
  shapesById: Map<string, CanvasShape>;
  readOnly: boolean;
}

// Connect é só uma ligação (linha) entre duas formas, sem indicar
// direção - de propósito, sem arrowhead/marker.
export default function CanvasLinksLayer({ links, shapesById, readOnly }: CanvasLinksLayerProps) {
  return (
    <>
      {links.links.map((link) => {
        const from = shapesById.get(link.fromShapeId);
        const to = shapesById.get(link.toShapeId);
        // Ligação órfã (a forma referenciada já não existe) - não há nada
        // válido para desenhar. Não deve acontecer na prática, mas fica
        // seguro perante dados antigos/editados por fora.
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
                style={{ paintOrder: 'stroke', stroke: CANVAS_PAPER_COLOR, strokeWidth: 3 }}
              >
                {link.label}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
