import type { Stroke } from '../../../types/models';
import { strokeToPathData } from '../../../utils/strokeToPath';

interface CanvasStrokesLayerProps {
  strokes: Stroke[];
  currentStroke: Stroke | null;
}

function StrokePath({ stroke }: { stroke: Stroke }) {
  return (
    <path
      d={strokeToPathData(stroke)}
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  );
}

// Tracos ja terminados mais o que esta a ser desenhado agora.
export default function CanvasStrokesLayer({ strokes, currentStroke }: CanvasStrokesLayerProps) {
  return (
    <>
      {strokes.map((stroke, index) => (
        <StrokePath key={index} stroke={stroke} />
      ))}
      {currentStroke && <StrokePath stroke={currentStroke} />}
    </>
  );
}
