import type { CanvasTextItem } from '../../../types/models';
import type { UseCanvasTextsResult } from '../../../hooks/useCanvasTexts';
import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_TEXT_COLOR } from '../../../hooks/useCanvasTexts';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import ColorSwatches from '../../UI/ColorSwatches';
import ToolbarButton from '../../UI/ToolbarButton';
import { COLOR_SWATCHES } from './canvasConstants';

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 36;

interface SelectedTextControlsProps {
  item: CanvasTextItem;
  texts: UseCanvasTextsResult;
}

// Controlos do texto selecionado: editar, tamanho, cor e apagar.
export default function SelectedTextControls({ item, texts }: SelectedTextControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <ToolbarButton
        aria-label="Edit text"
        title="Edit (or double-click/double-tap the text)"
        onClick={() => texts.startEditing(item.id)}
      >
        <PencilIcon className="h-3.5 w-3.5" />
        Edit
      </ToolbarButton>
      <input
        type="range"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        step={1}
        value={item.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
        onChange={(e) => texts.setFontSize(item.id, Number(e.target.value))}
        className="w-20 accent-violet-500"
        aria-label="Text size"
        title="Text size"
      />
      <ColorSwatches
        size="sm"
        colors={COLOR_SWATCHES}
        selected={item.color ?? DEFAULT_TEXT_COLOR}
        labelPrefix="Text color"
        onSelect={(color) => texts.setColor(item.id, color)}
      />
      <ToolbarButton
        tone="danger"
        aria-label="Delete text"
        title="Delete (or press Delete/Backspace)"
        onClick={() => texts.removeText(item.id)}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Delete text
      </ToolbarButton>
    </div>
  );
}
