import AreaCard from './AreaCard';
import type { Area } from '../../types/models';

interface AreaGridProps {
  areas: Area[];
  canManage: (area: Area) => boolean;
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
  onToggleHidden?: (area: Area) => void;
}

export default function AreaGrid({ areas, canManage, onSelect, onEdit, onDelete, onToggleHidden }: AreaGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {areas.map((area) => (
        <AreaCard
          key={area.id}
          area={area}
          canManage={canManage(area)}
          onSelect={onSelect}
          onEdit={onEdit}
          onDelete={onDelete}
          onToggleHidden={onToggleHidden}
        />
      ))}
    </div>
  );
}
