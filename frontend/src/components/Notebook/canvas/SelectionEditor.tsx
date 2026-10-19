import { TrashIcon, XIcon } from '../../UI/Icons';
import IconButton from '../../UI/IconButton';
import ToolbarButton from '../../UI/ToolbarButton';
import { useI18n } from '../../../i18n/useI18n';

interface SelectionEditorProps {
  // "shape" ou "link": entra nos aria-labels ("Delete shape", "Selected link label").
  noun: string;
  label: string;
  placeholder: string;
  inputWidthClass: string;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  onDeselect: () => void;
}

const LABEL_MAX_LENGTH = 40;

// Editor do item selecionado no canvas (etiqueta + apagar + deselecionar).
// Formas e ligacoes usavam o mesmo bloco, copiado.
export default function SelectionEditor({
  noun,
  label,
  placeholder,
  inputWidthClass,
  onLabelChange,
  onDelete,
  onDeselect,
}: SelectionEditorProps) {
  const { t } = useI18n();
  return (
    <div className="ml-auto flex items-center gap-2">
      <input
        value={label}
        onChange={(e) => onLabelChange(e.target.value)}
        placeholder={placeholder}
        maxLength={LABEL_MAX_LENGTH}
        aria-label={t('ui.selectedNounLabel', { noun })}
        className={`${inputWidthClass} rounded-md border border-neutral-800 bg-neutral-950 px-2 py-1 text-xs text-neutral-100 focus:border-violet-500 focus:outline-none`}
      />
      <ToolbarButton tone="danger" aria-label={t('ui.deleteNamed', { name: noun })} onClick={onDelete}>
        <TrashIcon className="h-3.5 w-3.5" />
        {t('common.delete')}
      </ToolbarButton>
      <IconButton label={t('ui.deselectNoun', { noun })} className="hover:bg-neutral-800 hover:text-neutral-200" onClick={onDeselect}>
        <XIcon className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
