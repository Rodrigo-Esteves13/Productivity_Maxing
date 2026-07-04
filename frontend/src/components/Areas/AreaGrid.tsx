import AreaCard from './AreaCard';
import type { Area } from '../../types/models';

interface AreaGridProps {
  areas: Area[];
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
}

export default function AreaGrid({ areas, onSelect, onEdit, onDelete }: AreaGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {areas.map((area) => (
        <AreaCard key={area.id} area={area} onSelect={onSelect} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
