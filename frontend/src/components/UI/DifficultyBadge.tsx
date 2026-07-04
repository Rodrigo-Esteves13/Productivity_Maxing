import type { Difficulty } from '../../types/models';

interface DifficultyBadgeProps {
  difficulty: Difficulty;
}

export default function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  // Mapeamos cada dificuldade para as cores do Tailwind
  const styles: Record<string, string> = {
    FACIL: 'bg-green-900/30 text-green-400 border-green-800/50',
    MEDIO: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/50',
    DIFICIL: 'bg-orange-900/30 text-orange-400 border-orange-800/50',
    MUITO_DIFICIL: 'bg-red-900/30 text-red-400 border-red-800/50',
  };

  // Mapeamos para um texto bonito
  const labels: Record<string, string> = {
    FACIL: 'Easy',
    MEDIO: 'Medium',
    DIFICIL: 'Hard',
    MUITO_DIFICIL: 'Very Hard',
  };

  // Se por acaso vier uma dificuldade nova que não mapeámos, usamos um estilo neutro
  const currentStyle = styles[difficulty as string] || 'bg-neutral-800 text-neutral-300 border-neutral-700';
  const currentLabel = labels[difficulty as string] || difficulty;

  return (
    <span className={`px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md border ${currentStyle}`}>
      {currentLabel}
    </span>
  );
}