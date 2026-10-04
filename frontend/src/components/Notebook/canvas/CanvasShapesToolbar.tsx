import type { CanvasLink, CanvasShape } from '../../../types/models';
import type { UseCanvasShapesResult } from '../../../hooks/useCanvasShapes';
import type { UseCanvasLinksResult } from '../../../hooks/useCanvasLinks';
import { LinkIcon } from '../../UI/Icons';
import SectionLabel from '../../UI/SectionLabel';
import ToolbarButton from '../../UI/ToolbarButton';
import { CANVAS_SHAPE_DEFS } from '../canvasShapeDefs';
import SelectionEditor from './SelectionEditor';

interface CanvasShapesToolbarProps {
  shapes: UseCanvasShapesResult;
  links: UseCanvasLinksResult;
  selectedShape: CanvasShape | null;
  selectedLink: CanvasLink | null;
  onDeleteSelectedShape: () => void;
}

function connectLabel(links: UseCanvasLinksResult): string {
  if (!links.connectMode) return 'Connect';
  return links.pendingSourceId ? 'Click the 2nd shape...' : 'Click the 1st shape...';
}

// Segunda barra, à parte da de traço/apagador - são dois modelos
// diferentes (forma posicionável vs. pincelada), por isso os controlos
// ficam separados em vez de misturados na mesma linha.
export default function CanvasShapesToolbar({
  shapes,
  links,
  selectedShape,
  selectedLink,
  onDeleteSelectedShape,
}: CanvasShapesToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-neutral-900 px-3 py-2">
      <SectionLabel>Shapes</SectionLabel>
      <div className="flex flex-wrap items-center gap-1.5">
        {CANVAS_SHAPE_DEFS.map((def) => (
          <button
            key={def.type}
            type="button"
            onClick={() => shapes.addShape(def.type)}
            className="rounded-md border border-neutral-700 px-2 py-1 text-xs font-medium text-neutral-200 hover:border-violet-500 hover:text-white"
          >
            {def.paletteLabel}
          </button>
        ))}
      </div>

      <ToolbarButton pressed={links.connectMode} title="Click two shapes to link them" onClick={links.toggleConnectMode}>
        <LinkIcon className="h-3.5 w-3.5" />
        {connectLabel(links)}
      </ToolbarButton>

      {selectedShape && (
        <SelectionEditor
          noun="shape"
          label={selectedShape.label}
          placeholder="Label"
          inputWidthClass="w-28"
          onLabelChange={(label) => shapes.relabelShape(selectedShape.id, label)}
          onDelete={onDeleteSelectedShape}
          onDeselect={() => shapes.selectShape(null)}
        />
      )}

      {!selectedShape && selectedLink && (
        <SelectionEditor
          noun="link"
          label={selectedLink.label}
          placeholder="Link label (optional)"
          inputWidthClass="w-36"
          onLabelChange={(label) => links.relabelLink(selectedLink.id, label)}
          onDelete={() => links.removeLink(selectedLink.id)}
          onDeselect={() => links.selectLink(null)}
        />
      )}
    </div>
  );
}
