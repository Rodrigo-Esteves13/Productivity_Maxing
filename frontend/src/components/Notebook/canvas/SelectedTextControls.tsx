import type { CanvasTextItem } from '../../../types/models';
import type { UseCanvasTextsResult } from '../../../hooks/useCanvasTexts';
import { DEFAULT_TEXT_FONT_SIZE, DEFAULT_TEXT_COLOR } from '../../../hooks/useCanvasTexts';
import { PencilIcon, TrashIcon } from '../../UI/Icons';
import ColorSwatches from '../../UI/ColorSwatches';
import ToolbarButton from '../../UI/ToolbarButton';
import { COLOR_SWATCHES } from './canvasConstants';
import { useI18n } from '../../../i18n/useI18n';

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 36;

interface SelectedTextControlsProps {
  item: CanvasTextItem;
  texts: UseCanvasTextsResult;
}

// Controlos do texto selecionado: editar, tamanho, cor e apagar.
export default function SelectedTextControls({ item, texts }: SelectedTextControlsProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <ToolbarButton
        aria-label={t('ui.editText')}
        title={t('ui.editOrDoubleClickDouble')}
        onClick={() => texts.startEditing(item.id)}
      >
        <PencilIcon className="h-3.5 w-3.5" />
        {t('notebook.edit')}
      </ToolbarButton>
      <input
        type="range"
        min={MIN_FONT_SIZE}
        max={MAX_FONT_SIZE}
        step={1}
        value={item.fontSize ?? DEFAULT_TEXT_FONT_SIZE}
        onChange={(e) => texts.setFontSize(item.id, Number(e.target.value))}
        className="w-20 accent-violet-500"
        aria-label={t('ui.textSize')}
        title={t('ui.textSize')}
      />
      <ColorSwatches
        size="sm"
        colors={COLOR_SWATCHES}
        selected={item.color ?? DEFAULT_TEXT_COLOR}
        labelPrefix={t('ui.textColor')}
        onSelect={(color) => texts.setColor(item.id, color)}
      />
      <ToolbarButton
        tone="danger"
        aria-label={t('ui.deleteText')}
        title={t('ui.deleteOrPressDeleteBackspace')}
        onClick={() => texts.removeText(item.id)}
      >
        <TrashIcon className="h-3.5 w-3.5" />
        {t('ui.deleteText')}
      </ToolbarButton>
    </div>
  );
}
