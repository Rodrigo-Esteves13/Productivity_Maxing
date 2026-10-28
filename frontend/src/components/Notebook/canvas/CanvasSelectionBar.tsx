import ToolbarButton from '../../UI/ToolbarButton';
import { CopyIcon, DuplicateIcon, PasteIcon, TrashIcon } from '../../UI/Icons';
import type { UseCanvasSelectionResult } from '../../../hooks/useCanvasSelection';
import { useI18n } from '../../../i18n/useI18n';

interface CanvasSelectionBarProps {
  selection: UseCanvasSelectionResult;
  onPasted: () => void;
}

// Acoes da selecao por caixa, a flutuar no canto de baixo do quadro: nao
// empurra o quadro ao trocar de ferramenta e nao tapa o topo, onde o
// conteudo costuma comecar. Tambem ha Ctrl+C/V/D e Delete, mas no
// telemovel e tablet nao ha teclado.
export default function CanvasSelectionBar({ selection, onPasted }: CanvasSelectionBarProps) {
  const { t } = useI18n();
  return (
    <div className="absolute bottom-2 right-2 flex flex-wrap items-center justify-end gap-1 rounded-lg bg-neutral-900/95 p-1 shadow-lg">
      <ToolbarButton onClick={selection.copy} disabled={!selection.hasSelection}>
        <CopyIcon className="h-4 w-4" />
        {t('canvas.copy')}
      </ToolbarButton>
      <ToolbarButton
        onClick={() => {
          selection.paste();
          onPasted();
        }}
        disabled={!selection.canPaste}
      >
        <PasteIcon className="h-4 w-4" />
        {t('canvas.paste')}
      </ToolbarButton>
      <ToolbarButton onClick={selection.duplicate} disabled={!selection.hasSelection}>
        <DuplicateIcon className="h-4 w-4" />
        {t('canvas.duplicate')}
      </ToolbarButton>
      <ToolbarButton tone="danger" onClick={selection.removeSelected} disabled={!selection.hasSelection}>
        <TrashIcon className="h-4 w-4" />
        {t('canvas.deleteSelection')}
      </ToolbarButton>
    </div>
  );
}
