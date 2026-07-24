import DetailRow from '../UI/DetailRow';
import ColorDot from '../UI/ColorDot';
import type { Area, TaskTypeOption } from '../../types/models';

interface AreaDetailViewProps {
  area: Area;
  taskTypes: TaskTypeOption[];
}

export default function AreaDetailView({ area, taskTypes }: AreaDetailViewProps) {
  const associatedType = taskTypes.find((t) => t.key === area.defaultTaskType);

  return (
    <div className="-mt-2">
      <DetailRow label="Area Name">{area.name}</DetailRow>
      <DetailRow label="Associated Color">
        <div className="flex items-center gap-3">
          <ColorDot color={area.colorHex} variant="square" size="md" />
          <span className="text-neutral-200 font-mono text-sm uppercase tracking-widest">
            {area.colorHex}
          </span>
        </div>
      </DetailRow>
      <DetailRow label="Associated Type">
        {associatedType ? associatedType.label : <span className="text-neutral-500 italic">None, asked every time</span>}
      </DetailRow>
      <DetailRow label="Credits">
        {area.credits ?? <span className="text-neutral-500 italic">Not set</span>}
      </DetailRow>
    </div>
  );
}
