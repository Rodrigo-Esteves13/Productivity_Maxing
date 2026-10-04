import type { UseDrawingCanvasResult } from '../../../hooks/useDrawingCanvas';
import type { UseCanvasTextsResult } from '../../../hooks/useCanvasTexts';
import type { CanvasTextItem } from '../../../types/models';
import { EraserIcon, PencilIcon, TrashIcon, TypeIcon, UndoIcon } from '../../UI/Icons';
import ColorSwatches from '../../UI/ColorSwatches';
import SegmentedControl from '../../UI/SegmentedControl';
import type { SegmentedOption } from '../../UI/SegmentedControl';
import ToolbarButton from '../../UI/ToolbarButton';
import SelectedTextControls from './SelectedTextControls';
import { COLOR_SWATCHES } from './canvasConstants';
import type { DrawTool } from './canvasConstants';

const MIN_STROKE_WIDTH = 1;
const MAX_STROKE_WIDTH = 8;

const TOOL_OPTIONS: SegmentedOption<DrawTool>[] = [
  { value: 'pen', label: 'Draw', icon: PencilIcon },
  { value: 'eraser', label: 'Eraser', icon: EraserIcon },
  { value: 'text', label: 'Text', icon: TypeIcon, title: 'Click the whiteboard to type text' },
];

interface CanvasDrawToolbarProps {
  canvas: UseDrawingCanvasResult;
  texts: UseCanvasTextsResult;
  selectedText: CanvasTextItem | null;
  tool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
}

// Barra de traco/apagador/texto: cor, espessura, ferramenta, controlos do
// texto selecionado e desfazer/limpar.
export default function CanvasDrawToolbar({ canvas, texts, selectedText, tool, onToolChange }: CanvasDrawToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2">
      <ColorSwatches
        colors={COLOR_SWATCHES}
        selected={tool === 'pen' ? canvas.color : null}
        labelPrefix="Use color"
        onSelect={(color) => {
          canvas.setColor(color);
          onToolChange('pen');
        }}
      />

      <input
        type="range"
        min={MIN_STROKE_WIDTH}
        max={MAX_STROKE_WIDTH}
        step={0.5}
        value={canvas.width}
        onChange={(e) => canvas.setWidth(Number(e.target.value))}
        className="w-24 accent-violet-500"
        aria-label="Stroke width"
      />

      <SegmentedControl size="sm" surface="sunken" options={TOOL_OPTIONS} value={tool} onChange={onToolChange} />

      {selectedText && !texts.editingId && <SelectedTextControls item={selectedText} texts={texts} />}

      <div className="ml-auto flex items-center gap-2">
        <ToolbarButton onClick={canvas.undo} disabled={!canvas.canUndo}>
          <UndoIcon className="h-4 w-4" />
          Undo
        </ToolbarButton>
        <ToolbarButton tone="danger" onClick={canvas.clear} disabled={!canvas.canUndo}>
          <TrashIcon className="h-4 w-4" />
          Clear
        </ToolbarButton>
      </div>
    </div>
  );
}
