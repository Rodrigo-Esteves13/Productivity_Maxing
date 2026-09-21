import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasTextItem } from '../../types/models';
import type { SvgPoint } from './NotebookShapeNode';
import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_TEXT_COLOR } from '../../hooks/useCanvasTexts';

interface NotebookTextNodeProps {
  item: CanvasTextItem;
  isSelected: boolean;
  isEditing: boolean;
  readOnly: boolean;
  toSvgPoint: (e: ReactPointerEvent<SVGElement>) => SvgPoint | null;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onStartEdit: () => void;
}

// Só a versão "de leitura" (arrastável, duplo-clique reabre para
// editar). A caixa de edição em si (um <input> a sério) é desenhada por
// cima do <svg>, não dentro dele - ver o overlay em NotebookCanvas.tsx.
// <input> dentro de <foreignObject> era pouco fiável entre browsers (não
// aparecia de todo nalguns casos), por isso deixou de se usar essa via.
export default function NotebookTextNode({
  item,
  isSelected,
  isEditing,
  readOnly,
  toSvgPoint,
  onSelect,
  onMove,
  onStartEdit,
}: NotebookTextNodeProps) {
  const dragRef = useRef<{ startPoint: SvgPoint; startX: number; startY: number } | null>(null);
  const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const color = item.color ?? DEFAULT_TEXT_COLOR;

  const handlePointerDown = (e: ReactPointerEvent<SVGTextElement>) => {
    if (readOnly || isEditing) return;
    e.stopPropagation();
    onSelect();
    const point = toSvgPoint(e);
    if (!point) return;
    dragRef.current = { startPoint: point, startX: item.x, startY: item.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGTextElement>) => {
    if (!dragRef.current) return;
    const point = toSvgPoint(e);
    if (!point) return;
    const { startPoint, startX, startY } = dragRef.current;
    onMove(startX + (point.x - startPoint.x), startY + (point.y - startPoint.y));
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  // A caixa de overlay HTML cobre exatamente este espaço enquanto edita
  // - nada para desenhar aqui nesse período (evita "texto fantasma" por
  // baixo do input enquanto escreves).
  if (isEditing) return null;

  return (
    <g>
      {isSelected && !readOnly && (
        <rect
          x={item.x - 4}
          y={item.y - 2}
          width={Math.max(item.text.length * fontSize * 0.55, 16) + 8}
          height={fontSize + 8}
          rx={3}
          fill="none"
          stroke="#7C3AED"
          strokeDasharray="4 2"
        />
      )}
      <text
        x={item.x}
        y={item.y + fontSize}
        fontSize={fontSize}
        fill={color}
        style={{ paintOrder: 'stroke', stroke: 'rgba(245,241,232,0.75)', strokeWidth: 4 }}
        className={readOnly ? '' : 'cursor-move select-none'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onDoubleClick={(e) => {
          if (readOnly) return;
          e.stopPropagation();
          onStartEdit();
        }}
      >
        {item.text}
      </text>
    </g>
  );
}
