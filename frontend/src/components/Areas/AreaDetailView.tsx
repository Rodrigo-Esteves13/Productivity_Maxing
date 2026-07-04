import DetailRow from '../UI/DetailRow';
import ColorDot from '../UI/ColorDot';
import type { Area } from '../../types/models';

interface AreaDetailViewProps {
  area: Area;
}

export default function AreaDetailView({ area }: AreaDetailViewProps) {
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
    </div>
  );
}
