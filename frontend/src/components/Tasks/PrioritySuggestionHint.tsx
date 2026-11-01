import { useCatalogLabel } from '../../hooks/useCatalogLabel';
import { useI18n } from '../../i18n/useI18n';

interface PrioritySuggestionHintProps {
  // Chave sugerida pelo backend; null/undefined = nada a mostrar.
  suggestedKey: string | null | undefined;
  // Prioridades do catalogo, para mostrar o rotulo e validar a chave.
  priorities: { key: string; label: string }[];
  onApply: (key: string) => void;
}

// Sugestao discreta: a prioridade e sempre escolhida pelo user.
export default function PrioritySuggestionHint({ suggestedKey, priorities, onApply }: PrioritySuggestionHintProps) {
  const { t } = useI18n();
  const { catalogLabel } = useCatalogLabel();
  const match = suggestedKey ? priorities.find((p) => p.key === suggestedKey) : undefined;
  if (!suggestedKey || !match) return null;

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      <span>{t('tasks.prioritySuggestion', { priority: catalogLabel('priority', match.key, match.label) })}</span>
      <button
        type="button"
        onClick={() => onApply(match.key)}
        className="rounded-md border border-violet-800 px-2 py-0.5 font-semibold text-violet-300 hover:bg-violet-900/40"
      >
        {t('tasks.prioritySuggestionApply')}
      </button>
    </div>
  );
}
