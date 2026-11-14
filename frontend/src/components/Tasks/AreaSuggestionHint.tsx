import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { suggestAreaId, type AreaCandidate } from '../../lib/areaSuggestion';
import { useI18n } from '../../i18n/useI18n';

interface AreaSuggestionHintProps {
  title: string;
  areas: AreaCandidate[];
  tasks: Task[];
  // So sugere enquanto nenhuma cadeira estiver escolhida.
  currentAreaId: string;
  onApply: (areaId: string) => void;
}

// Sugestao discreta: a cadeira e sempre escolhida pelo user.
export default function AreaSuggestionHint({ title, areas, tasks, currentAreaId, onApply }: AreaSuggestionHintProps) {
  const { t } = useI18n();
  const suggestedId = useMemo(() => suggestAreaId(title, areas, tasks), [title, areas, tasks]);
  const area = suggestedId ? areas.find((a) => a.id === suggestedId) : undefined;
  if (!area || currentAreaId) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      <span>{t('areaSuggestion.text', { area: area.name })}</span>
      <button
        type="button"
        onClick={() => onApply(area.id)}
        className="rounded-md border border-violet-800 px-2 py-0.5 font-semibold text-violet-300 hover:bg-violet-900/40"
      >
        {t('areaSuggestion.apply')}
      </button>
    </div>
  );
}
