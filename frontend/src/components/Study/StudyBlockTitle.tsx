import ColorDot from '../UI/ColorDot';
import type { StudyPlanSuggestion } from '../../types/models';

interface StudyBlockTitleProps {
  block: Pick<StudyPlanSuggestion, 'kind' | 'taskTitle' | 'areaName' | 'areaColorHex'>;
  className?: string;
}

// Titulo de um bloco de estudo com o nome da Area (cadeira) a frente. Os
// blocos de revisao ja se chamam "Review: <cadeira>", por isso nao repetem.
// Partilhado pelo "Study blocks for today" (Focus) e pela lista do plano.
export default function StudyBlockTitle({ block, className = '' }: StudyBlockTitleProps) {
  const showArea = block.kind !== 'review' && Boolean(block.areaName);
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      {showArea && (
        <>
          {block.areaColorHex && <ColorDot size="xs" color={block.areaColorHex} />}
          <span className="max-w-[45%] shrink-0 truncate text-neutral-400">{block.areaName}</span>
          <span aria-hidden="true" className="shrink-0 text-neutral-600">
            ·
          </span>
        </>
      )}
      <span className="truncate">{block.taskTitle}</span>
    </span>
  );
}
