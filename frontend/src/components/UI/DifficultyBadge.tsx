import type { Difficulty } from '../../types/models';
import { formatEnumLabel } from '../../utils/formatEnumLabel';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export default function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  // Color per difficulty level (labels are derived automatically from the enum value)
  const styles: Record<string, string> = {
    VERY_EASY: 'bg-cyan-900/30 text-cyan-300 border-cyan-800/40',
    EASY: 'bg-cyan-900/30 text-cyan-400 border-cyan-800/50',
    MEDIUM: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50',
    HARD: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
    VERY_HARD: 'bg-red-900/30 text-red-400 border-red-800/50',
  };

  // Fallback in case a difficulty we don't have a color for shows up
  const currentStyle = styles[difficulty as string] || 'bg-neutral-800 text-neutral-300 border-neutral-700';

  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border ${currentStyle}`}>
      {formatEnumLabel(difficulty)}
    </span>
  );
}
