import type { CanvasShape } from '../../types/models';

export interface Point {
  x: number;
  y: number;
}

function centerOf(shape: CanvasShape): Point {
  return { x: shape.x + shape.width / 2, y: shape.y + shape.height / 2 };
}

// Ponto onde a reta do centro de `shape` até `target` cruza o contorno
// do retângulo de `shape` - é o que dá o "efeito draw.io" de a linha
// nascer/acabar na borda da caixa em vez de atravessar visualmente por
// cima dela. Álgebra standard de clipping ponto-retângulo: escala o
// vetor centro->target pelo menor fator que o traz para cima de uma das
// 4 arestas.
function clipPointToRectEdge(shape: CanvasShape, target: Point): Point {
  const center = centerOf(shape);
  const dx = target.x - center.x;
  const dy = target.y - center.y;

  if (dx === 0 && dy === 0) return center;

  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;
  const scaleX = dx !== 0 ? halfWidth / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfHeight / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);

  return { x: center.x + dx * scale, y: center.y + dy * scale };
}

/**
 * Os dois pontos (borda de `from`, borda de `to`) que definem a linha de
 * uma ligação entre duas formas, recalculados a partir da posição atual
 * de ambas - é isto que faz a ligação "seguir" a forma ao ser arrastada
 * (NotebookCanvas re-renderiza os links a cada mudança de shapes.shapes).
 */
export function computeLinkEndpoints(from: CanvasShape, to: CanvasShape): { start: Point; end: Point } {
  return {
    start: clipPointToRectEdge(from, centerOf(to)),
    end: clipPointToRectEdge(to, centerOf(from)),
  };
}
