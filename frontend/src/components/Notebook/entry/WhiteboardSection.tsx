import { useState } from 'react';
import type { UseDrawingCanvasResult } from '../../../hooks/useDrawingCanvas';
import type { UseCanvasShapesResult } from '../../../hooks/useCanvasShapes';
import type { UseCanvasLinksResult } from '../../../hooks/useCanvasLinks';
import type { UseCanvasTextsResult } from '../../../hooks/useCanvasTexts';
import { PenToolIcon } from '../../UI/Icons';
import { useI18n } from '../../../i18n/useI18n';
import EntrySectionHeader from './EntrySectionHeader';
import NotebookCanvas from '../NotebookCanvas';

interface WhiteboardSectionProps {
  canvas: UseDrawingCanvasResult;
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  texts: UseCanvasTextsResult;
  isEditing: boolean;
  canvasHeight: number;
  onGrowCanvas: () => void;
}

// O quadro branco so existe quando e preciso: uma entrada sem desenho,
// formas ou texto no quadro nao mostra nada em leitura, e em edicao oferece
// "Add whiteboard". Assim as entradas so de texto/fotos nao arrastam um
// quadro vazio enorme. Depois de adicionado (ou se ja tem conteudo), fica.
export default function WhiteboardSection({
  canvas,
  shapes,
  links,
  texts,
  isEditing,
  canvasHeight,
  onGrowCanvas,
}: WhiteboardSectionProps) {
  const { t } = useI18n();
  const [isAdded, setIsAdded] = useState(false);

  const hasContent =
    canvas.strokes.length > 0 || shapes.shapes.length > 0 || texts.texts.length > 0;

  if (!hasContent && !isAdded) {
    if (!isEditing) return null;
    return (
      <button
        type="button"
        onClick={() => setIsAdded(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-700 py-2 text-xs font-medium text-neutral-400 hover:border-violet-500 hover:text-violet-400"
      >
        <PenToolIcon className="h-4 w-4" />
        {t('notebook.whiteboard.add')}
      </button>
    );
  }

  // data-native-undo: Ctrl+Z aqui fica com o undo do quadro, nao o do texto.
  return (
    <section data-native-undo>
      <EntrySectionHeader
        icon={PenToolIcon}
        title={t('notebook.section.whiteboard')}
        action={
          isEditing && !hasContent && (
            <button
              type="button"
              onClick={() => setIsAdded(false)}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              {t('notebook.whiteboard.remove')}
            </button>
          )
        }
      />
      <NotebookCanvas
        canvas={canvas}
        shapes={shapes}
        links={links}
        texts={texts}
        readOnly={!isEditing}
        canvasHeight={canvasHeight}
        onGrowCanvas={isEditing ? onGrowCanvas : undefined}
      />
    </section>
  );
}
