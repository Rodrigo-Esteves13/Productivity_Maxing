import { useMemo } from 'react';
import type { Task } from '../../types/models';
import { suggestDifficulty } from '../../lib/difficultySuggestion';
import { useEnumLabel } from '../../hooks/useEnumLabel';
import { useI18n } from '../../i18n/useI18n';

interface DifficultySuggestionHintProps {
  tasks: Task[];
  areaId: string;
  type: string;
  difficulties: string[];
  current: string;
  onApply: (difficulty: string) => void;
}

// Sugestao discreta: a dificuldade e sempre escolhida pelo user.
export default function DifficultySuggestionHint({
  tasks,
  areaId,
  type,
  difficulties,
  current,
  onApply,
}: DifficultySuggestionHintProps) {
  const { t } = useI18n();
  const enumLabel = useEnumLabel();
  const suggestion = useMemo(
    () => suggestDifficulty(tasks, { areaId, type }, difficulties),
    [tasks, areaId, type, difficulties],
  );
  if (!suggestion || suggestion.difficulty === current) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
      <span>
        {t('difficultySuggestion.text', {
          difficulty: enumLabel(suggestion.difficulty),
          count: suggestion.basedOn,
        })}
      </span>
      <button
        type="button"
        onClick={() => onApply(suggestion.difficulty)}
        className="rounded-md border border-violet-800 px-2 py-0.5 font-semibold text-violet-300 hover:bg-violet-900/40"
      >
        {t('difficultySuggestion.apply')}
      </button>
    </div>
  );
}
