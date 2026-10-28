import { describe, expect, it } from 'vitest';
import {
  copySelection,
  offsetClipboard,
  rectFromPoints,
  selectInRect,
  selectionBounds,
  type CanvasContent,
} from './canvasSelection';

const content: CanvasContent = {
  strokes: [
    // Uma caixa desenhada a mao, dentro de (10,10)-(60,60).
    { color: '#000', width: 2, points: [{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 60, y: 60 }, { x: 10, y: 60 }] },
    // Fora: atravessa a margem direita.
    { color: '#000', width: 2, points: [{ x: 150, y: 20 }, { x: 400, y: 20 }] },
  ],
  shapes: [
    { id: 'a', type: 'router', x: 20, y: 20, width: 20, height: 20, label: 'A' },
    { id: 'b', type: 'switch', x: 30, y: 30, width: 20, height: 20, label: 'B' },
    { id: 'c', type: 'pc', x: 300, y: 300, width: 40, height: 40, label: 'C' },
  ],
  links: [
    { id: 'ab', fromShapeId: 'a', toShapeId: 'b', label: '' },
    { id: 'ac', fromShapeId: 'a', toShapeId: 'c', label: '' },
  ],
  texts: [{ id: 't', x: 15, y: 80, text: 'Hi', fontSize: 10 }],
} as CanvasContent;

describe('canvas selection', () => {
  const box = rectFromPoints({ x: 200, y: 100 }, { x: 0, y: 0 });

  it('selects only what is fully inside the box', () => {
    expect(selectInRect(box, content)).toEqual({ strokes: [0], shapes: ['a', 'b'], texts: ['t'] });
  });

  it('bounds cover every selected item', () => {
    const bounds = selectionBounds({ strokes: [0], shapes: ['a'], texts: [] }, content);
    expect(bounds).toEqual({ x: 10, y: 10, width: 50, height: 50 });
  });

  it('copies links only when both ends are copied', () => {
    const clip = copySelection(selectInRect(box, content), content);
    expect(clip.links.map((l) => l.id)).toEqual(['ab']);
  });

  it('pasting creates new ids, offsets positions and remaps links', () => {
    let n = 0;
    const clip = copySelection(selectInRect(box, content), content);
    const pasted = offsetClipboard(clip, 24, 24, () => `new${n++}`);
    expect(pasted.shapes.map((s) => s.id)).toEqual(['new0', 'new1']);
    expect(pasted.shapes[0]).toMatchObject({ x: 44, y: 44 });
    expect(pasted.links[0]).toMatchObject({ fromShapeId: 'new0', toShapeId: 'new1' });
    expect(pasted.strokes[0].points[0]).toEqual({ x: 34, y: 34 });
    expect(pasted.texts[0]).toMatchObject({ x: 39, y: 104 });
    // O original nao muda.
    expect(content.shapes[0].x).toBe(20);
  });
});
