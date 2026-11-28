import { describe, expect, it } from 'vitest';
import { getCanvasClipboard, setCanvasClipboard } from './canvasSelection';
import { runSessionResets } from './sessionReset';

describe('session reset', () => {
  it('forgets the canvas clipboard of the previous account', () => {
    setCanvasClipboard({ strokes: [], shapes: [], lines: [], texts: [] } as never);
    expect(getCanvasClipboard()).not.toBeNull();
    runSessionResets();
    expect(getCanvasClipboard()).toBeNull();
  });
});
