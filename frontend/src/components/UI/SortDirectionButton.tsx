import { useI18n } from '../../i18n/useI18n';
import { ArrowUpIcon, ArrowDownIcon } from './Icons';
import type { SortDirection } from '../../lib/sortDirection';

interface SortDirectionButtonProps {
  direction: SortDirection;
  onToggle: () => void;
  // Texto de ajuda para cada sentido, ex: "Nearest first" / "Furthest first".
  ascLabel: string;
  descLabel: string;
}

// Botao unico que alterna crescente/decrescente. Reutilizado pela pagina
// de Tasks (junto ao seletor Manual/Date/Priority).
export default function SortDirectionButton({ direction, onToggle, ascLabel, descLabel }: SortDirectionButtonProps) {
  const { t } = useI18n();
  const label = direction === 'asc' ? ascLabel : descLabel;
  const Icon = direction === 'asc' ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={t('sort.reverseHint', { label })}
      aria-label={t('sort.ariaLabel', { label })}
      className="flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:text-white transition-colors"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
