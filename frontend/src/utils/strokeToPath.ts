import type { Stroke } from '../types/models';

// Curva quadrática entre pontos médios consecutivos - traço reto ponto-a-
// ponto fica visivelmente "poligonal" com um rato normal (poucos pontos
// por segundo comparado a uma caneta em ecrã tátil); isto suaviza sem
// perder a forma real do traço.
export function strokeToPathData(stroke: Stroke | null | undefined): string {
  if (!stroke || !stroke.points || stroke.points.length === 0) return '';
  const { points } = stroke;
  if (points.length === 1) {
    const [p] = points;
    return `M ${p.x} ${p.y} L ${p.x} ${p.y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
