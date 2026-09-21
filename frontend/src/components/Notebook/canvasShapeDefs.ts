import type { CanvasShapeType } from '../../types/models';

export interface CanvasShapeDef {
  type: CanvasShapeType;
  /** Short label shown on the palette button. */
  paletteLabel: string;
  /** Pre-filled into the shape's own label when it's first added. */
  defaultLabel: string;
  fill: string;
  stroke: string;
  defaultWidth: number;
  defaultHeight: number;
  /** Contorno visível: 'circle' (router/AP, à Cisco) ou 'rect' (os restantes). */
  boundary: 'circle' | 'rect';
}

// Cores por tipo (não todas a violeta) só para ser fácil distinguir um
// router de uma cloud a olho, num diagrama com vários - mesmo critério
// do StatusBadge/DifficultyBadge no resto da app (cor = categoria).
// Router e AP usam boundary 'circle' e por isso largura=altura (é o que
// dá um círculo, não uma elipse) - ver NotebookShapeNode.tsx.
export const CANVAS_SHAPE_DEFS: CanvasShapeDef[] = [
  { type: 'router', paletteLabel: 'Router', defaultLabel: 'R1', fill: '#DBEAFE', stroke: '#1D4ED8', defaultWidth: 70, defaultHeight: 70, boundary: 'circle' },
  { type: 'switch', paletteLabel: 'Switch', defaultLabel: 'SW1', fill: '#DCFCE7', stroke: '#15803D', defaultWidth: 90, defaultHeight: 60, boundary: 'rect' },
  { type: 'firewall', paletteLabel: 'Firewall', defaultLabel: 'FW1', fill: '#FEE2E2', stroke: '#B91C1C', defaultWidth: 90, defaultHeight: 60, boundary: 'rect' },
  { type: 'server', paletteLabel: 'Server', defaultLabel: 'SRV1', fill: '#EDE9FE', stroke: '#7C3AED', defaultWidth: 70, defaultHeight: 90, boundary: 'rect' },
  { type: 'pc', paletteLabel: 'PC', defaultLabel: 'PC1', fill: '#FEF3C7', stroke: '#B45309', defaultWidth: 80, defaultHeight: 60, boundary: 'rect' },
  { type: 'cloud', paletteLabel: 'Cloud', defaultLabel: 'Internet', fill: '#F1F5F9', stroke: '#475569', defaultWidth: 120, defaultHeight: 70, boundary: 'rect' },
  { type: 'ap', paletteLabel: 'AP', defaultLabel: 'AP1', fill: '#FCE7F3', stroke: '#BE185D', defaultWidth: 70, defaultHeight: 70, boundary: 'circle' },
];

export function getShapeDef(type: CanvasShapeType): CanvasShapeDef {
  return CANVAS_SHAPE_DEFS.find((def) => def.type === type) ?? CANVAS_SHAPE_DEFS[0];
}

