import { useI18n } from '../../i18n/useI18n';

interface SelectionToolbarProps {
  selectedCount: number;
  // Quantos podem ficar selecionados de uma vez (total da lista ou um limite).
  selectableCount: number;
  onSelectAll: () => void;
  onSelectNone: () => void;
  className?: string;
}

// "Selecionar tudo / nenhum" para listas com checkboxes (pacotes de tarefas ao
// criar e ao importar). Cada botao fica desativado quando ja nao faz nada.
export default function SelectionToolbar({
  selectedCount,
  selectableCount,
  onSelectAll,
  onSelectNone,
  className = '',
}: SelectionToolbarProps) {
  const { t } = useI18n();
  const buttonClass =
    'text-xs font-medium text-violet-400 hover:text-violet-300 disabled:text-neutral-600 disabled:cursor-not-allowed';
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button type="button" className={buttonClass} disabled={selectedCount >= selectableCount} onClick={onSelectAll}>
        {t('common.selectAll')}
      </button>
      <span aria-hidden="true" className="text-neutral-700">
        |
      </span>
      <button type="button" className={buttonClass} disabled={selectedCount === 0} onClick={onSelectNone}>
        {t('common.selectNone')}
      </button>
    </div>
  );
}
