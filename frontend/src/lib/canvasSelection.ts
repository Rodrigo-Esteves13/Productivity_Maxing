import type { CanvasLink, CanvasShape, CanvasTextItem, Stroke } from '../types/models';

// Selecao por caixa no quadro: o que fica todo dentro do retangulo arrastado
// (tracos a mao, formas e textos) e seleccionado; depois copia, cola,
// duplica, move ou apaga tudo junto. Funcoes puras para serem testaveis.

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasSelection {
  // Tracos nao tem id: seleccionam-se pela posicao na lista.
  strokes: number[];
  shapes: string[];
  texts: string[];
}

export interface CanvasContent {
  strokes: Stroke[];
  shapes: CanvasShape[];
  links: CanvasLink[];
  texts: CanvasTextItem[];
}

export type CanvasClipboard = CanvasContent;

export const EMPTY_SELECTION: CanvasSelection = { strokes: [], shapes: [], texts: [] };

// Distancia dos colados em relacao ao original (para nao ficarem por cima).
export const PASTE_OFFSET = 24;
// Largura aproximada de um caracter de texto, em fracao do tamanho da letra.
const TEXT_CHAR_WIDTH_RATIO = 0.6;
const DEFAULT_TEXT_SIZE = 14;

export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

export function isSelectionEmpty(selection: CanvasSelection): boolean {
  return selection.strokes.length + selection.shapes.length + selection.texts.length === 0;
}

function boundsOfPoints(points: { x: number; y: number }[]): Rect | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return rectFromPoints({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) });
}

function textRect(item: CanvasTextItem): Rect {
  const size = item.fontSize ?? DEFAULT_TEXT_SIZE;
  // y do texto e a linha de base (SVG): a caixa fica acima dela.
  return {
    x: item.x,
    y: item.y - size,
    width: Math.max(1, item.text.length) * size * TEXT_CHAR_WIDTH_RATIO,
    height: size,
  };
}

const shapeRect = (shape: CanvasShape): Rect => ({
  x: shape.x,
  y: shape.y,
  width: shape.width,
  height: shape.height,
});

function contains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

export function selectInRect(rect: Rect, content: Omit<CanvasContent, 'links'>): CanvasSelection {
  return {
    strokes: content.strokes.flatMap((stroke, index) => {
      const bounds = boundsOfPoints(stroke.points);
      return bounds && contains(rect, bounds) ? [index] : [];
    }),
    shapes: content.shapes.filter((shape) => contains(rect, shapeRect(shape))).map((shape) => shape.id),
    texts: content.texts.filter((item) => contains(rect, textRect(item))).map((item) => item.id),
  };
}

// Caixa a volta de tudo o que esta seleccionado (para a desenhar e para
// saber se um clique e "dentro da selecao", para a arrastar).
export function selectionBounds(selection: CanvasSelection, content: Omit<CanvasContent, 'links'>): Rect | null {
  const shapeIds = new Set(selection.shapes);
  const textIds = new Set(selection.texts);
  const rects: Rect[] = [
    ...selection.strokes.flatMap((i) => {
      const bounds = content.strokes[i] ? boundsOfPoints(content.strokes[i].points) : null;
      return bounds ? [bounds] : [];
    }),
    ...content.shapes.filter((s) => shapeIds.has(s.id)).map(shapeRect),
    ...content.texts.filter((t) => textIds.has(t.id)).map(textRect),
  ];
  if (rects.length === 0) return null;
  const corners = rects.flatMap((r) => [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
  ]);
  return boundsOfPoints(corners);
}

export function pointInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

// Copia o que esta seleccionado. Ligacoes so entram quando as duas formas
// das pontas tambem vao.
export function copySelection(selection: CanvasSelection, content: CanvasContent): CanvasClipboard {
  const shapeIds = new Set(selection.shapes);
  const textIds = new Set(selection.texts);
  return {
    strokes: selection.strokes.flatMap((i) => (content.strokes[i] ? [content.strokes[i]] : [])),
    shapes: content.shapes.filter((s) => shapeIds.has(s.id)),
    links: content.links.filter((l) => shapeIds.has(l.fromShapeId) && shapeIds.has(l.toShapeId)),
    texts: content.texts.filter((t) => textIds.has(t.id)),
  };
}

// Copia nova (ids novos) deslocada (dx, dy). As ligacoes passam a apontar
// para as formas novas.
export function offsetClipboard(
  clipboard: CanvasClipboard,
  dx: number,
  dy: number,
  newId: () => string = () => crypto.randomUUID(),
): CanvasClipboard {
  const idMap = new Map(clipboard.shapes.map((s) => [s.id, newId()]));
  return {
    strokes: clipboard.strokes.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
    })),
    shapes: clipboard.shapes.map((s) => ({ ...s, id: idMap.get(s.id) ?? newId(), x: s.x + dx, y: s.y + dy })),
    links: clipboard.links.map((l) => ({
      ...l,
      id: newId(),
      fromShapeId: idMap.get(l.fromShapeId) ?? l.fromShapeId,
      toShapeId: idMap.get(l.toShapeId) ?? l.toShapeId,
    })),
    texts: clipboard.texts.map((t) => ({ ...t, id: newId(), x: t.x + dx, y: t.y + dy })),
  };
}

// Area de transferencia do quadro, partilhada por todas as entradas abertas
// nesta tab (copiar numa nota e colar noutra). So em memoria.
let clipboardStore: CanvasClipboard | null = null;

export function setCanvasClipboard(clipboard: CanvasClipboard): void {
  clipboardStore = clipboard;
}

export function getCanvasClipboard(): CanvasClipboard | null {
  return clipboardStore;
}
