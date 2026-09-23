import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CanvasShape } from '../../types/models';
import { getShapeDef } from './canvasShapeDefs';
import NotebookShapeIcon from './NotebookShapeIcon';

export interface SvgPoint {
  x: number;
  y: number;
}

interface NotebookShapeNodeProps {
  shape: CanvasShape;
  isSelected: boolean;
  readOnly: boolean;
  /** True while Connect mode is on - clicks pick link endpoints instead of dragging. */
  connectMode: boolean;
  /** True when this shape is the pending first endpoint of a link being created. */
  isLinkSource: boolean;
  /** Converts a pointer event's client coordinates into the canvas's fixed viewBox coordinates. */
  toSvgPoint: (e: ReactPointerEvent<SVGElement>) => SvgPoint | null;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onLinkClick: () => void;
}

const HANDLE_SIZE = 14;

// Um <g> por forma, com a própria lógica de arrastar/redimensionar -
// mesmo padrão de pointer capture que o NotebookCanvas já usa para
// traços (setPointerCapture no elemento clicado, não no <svg> pai), só
// que aqui em dois handlers diferentes (corpo vs. pega de resize) para
// que arrastar e redimensionar não disparem os dois ao mesmo tempo.
export default function NotebookShapeNode({
  shape,
  isSelected,
  readOnly,
  connectMode,
  isLinkSource,
  toSvgPoint,
  onSelect,
  onMove,
  onResize,
  onLinkClick,
}: NotebookShapeNodeProps) {
  const def = getShapeDef(shape.type);
  const dragRef = useRef<{ startPoint: SvgPoint; startX: number; startY: number } | null>(null);
  const resizeRef = useRef<{ startPoint: SvgPoint; startWidth: number; startHeight: number } | null>(null);

  const handleBodyPointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (readOnly) return;
    e.stopPropagation();

    // Em modo Connect, um clique escolhe a forma como ponto de partida/
    // chegada da ligação - não arrasta. Fora desse modo, comportamento
    // normal de seleção + arrastar.
    if (connectMode) {
      onLinkClick();
      return;
    }

    onSelect();
    const point = toSvgPoint(e);
    if (!point) return;
    dragRef.current = { startPoint: point, startX: shape.x, startY: shape.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleBodyPointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!dragRef.current) return;
    const point = toSvgPoint(e);
    if (!point) return;
    const { startPoint, startX, startY } = dragRef.current;
    onMove(startX + (point.x - startPoint.x), startY + (point.y - startPoint.y));
  };

  const handleBodyPointerUp = () => {
    dragRef.current = null;
  };

  const handleResizePointerDown = (e: ReactPointerEvent<SVGRectElement>) => {
    if (readOnly) return;
    e.stopPropagation();
    const point = toSvgPoint(e);
    if (!point) return;
    resizeRef.current = { startPoint: point, startWidth: shape.width, startHeight: shape.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleResizePointerMove = (e: ReactPointerEvent<SVGRectElement>) => {
    if (!resizeRef.current) return;
    const point = toSvgPoint(e);
    if (!point) return;
    const { startPoint, startWidth, startHeight } = resizeRef.current;
    onResize(startWidth + (point.x - startPoint.x), startHeight + (point.y - startPoint.y));
  };

  const handleResizePointerUp = () => {
    resizeRef.current = null;
  };

  const cx = shape.x + shape.width / 2;
  const cy = shape.y + shape.height / 2;
  const highlightColor = isLinkSource ? '#2563EB' : isSelected ? '#7C3AED' : undefined;
  const isHighlighted = isLinkSource || isSelected;
  const cursorClass = readOnly ? '' : connectMode ? 'cursor-crosshair' : 'cursor-move';

  // Escala uniforme (não width/100 e height/100 em separado) - numa
  // forma não quadrada (a cloud é 120x70, por exemplo), escalar os dois
  // eixos de forma diferente distorcia os arcos do ícone (círculos
  // viravam elipses). Usa-se a dimensão menor e centra-se o ícone dentro
  // da caixa, com margem no eixo maior em vez de esticar.
  const iconScale = Math.min(shape.width, shape.height) / 100;
  const iconX = shape.x + (shape.width - 100 * iconScale) / 2;
  const iconY = shape.y + (shape.height - 100 * iconScale) / 2;

  return (
    <g>
      {/* Contorno visível - círculo para router/AP (convenção Cisco),
          retângulo arredondado para o resto. Sem handlers próprios: quem
          capta o pointer é sempre o rect transparente no fim deste <g>. */}
      {def.boundary === 'circle' ? (
        <circle
          cx={cx}
          cy={cy}
          r={Math.min(shape.width, shape.height) / 2}
          fill={def.fill}
          stroke={highlightColor ?? def.stroke}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
          strokeDasharray={isHighlighted ? '6 3' : undefined}
        />
      ) : (
        <rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={8}
          fill={def.fill}
          stroke={highlightColor ?? def.stroke}
          strokeWidth={isHighlighted ? 2.5 : 1.5}
          strokeDasharray={isHighlighted ? '6 3' : undefined}
        />
      )}

      {/* Glifo simplificado tipo Cisco (ver NotebookShapeIcon.tsx) -
          desenhado num espaço 0-100 e escalado para caber na forma. O
          clip-path garante que nada (o firewall em particular, que
          sangra de propósito para fora de 0-100 para o padrão de tijolo
          ficar consistente nas pontas) vaza da caixa/círculo visível. */}
      <g transform={`translate(${iconX} ${iconY}) scale(${iconScale})`}>
        <defs>
          <clipPath id={`shape-icon-clip-${shape.id}`}>
            {def.boundary === 'circle' ? (
              <circle cx={50} cy={50} r={50} />
            ) : (
              <rect x={0} y={0} width={100} height={100} rx={8} />
            )}
          </clipPath>
        </defs>
        <g clipPath={`url(#shape-icon-clip-${shape.id})`}>
          <NotebookShapeIcon type={shape.type} stroke={def.stroke} />
        </g>
      </g>

      {/* Label por cima da forma (não dentro) - "R1", "SW1", etc. */}
      <text
        x={cx}
        y={shape.y - 8}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="#1C1C1E"
        className="select-none"
      >
        {shape.label}
      </text>

      {/* Área de interação, sempre por cima do contorno/ícone/label
          (exceto da pega de resize, desenhada a seguir e por isso ainda
          mais acima) - capta cliques em toda a caixa delimitadora, mesmo
          quando o contorno visível é um círculo mais pequeno que essa
          caixa. Invisível de propósito (fill transparent), só o
          pointerEvents="all" é que garante que continua clicável. */}
      <rect
        x={shape.x}
        y={shape.y}
        width={shape.width}
        height={shape.height}
        fill="transparent"
        pointerEvents="all"
        className={cursorClass}
        onPointerDown={handleBodyPointerDown}
        onPointerMove={handleBodyPointerMove}
        onPointerUp={handleBodyPointerUp}
        onPointerLeave={handleBodyPointerUp}
      />

      {isSelected && !readOnly && !connectMode && (
        <g>
          {/* Alvo de toque maior que o quadrado visível - 14 unidades a
              escalar para um ecrã de telemóvel dá uns 6px reais, bem
              abaixo do mínimo tocável (~44px); esta área invisível de 30
              unidades resolve isso sem mudar o aspeto no desktop. */}
          <rect
            x={shape.x + shape.width - 15}
            y={shape.y + shape.height - 15}
            width={30}
            height={30}
            fill="transparent"
            pointerEvents="all"
            className="cursor-nwse-resize"
            onPointerDown={handleResizePointerDown}
            onPointerMove={handleResizePointerMove}
            onPointerUp={handleResizePointerUp}
            onPointerLeave={handleResizePointerUp}
          />
          <rect
            x={shape.x + shape.width - HANDLE_SIZE / 2}
            y={shape.y + shape.height - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            rx={2}
            fill="#7C3AED"
            pointerEvents="none"
          />
        </g>
      )}
    </g>
  );
}
