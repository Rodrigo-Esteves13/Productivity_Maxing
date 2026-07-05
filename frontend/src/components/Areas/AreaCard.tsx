import { PencilIcon, TrashIcon } from '../UI/Icons';
import ColorDot from '../UI/ColorDot';
import type { Area } from '../../types/models';

interface AreaCardProps {
  area: Area;
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
}

export default function AreaCard({ area, onSelect, onEdit, onDelete }: AreaCardProps) {
  return (
    <div className="p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl flex items-center justify-between hover:border-neutral-700 transition-colors">

      {/* Secção clicável (Abre modo Leitura) */}
      <div
        className="flex items-center gap-3 truncate cursor-pointer flex-1"
        onClick={() => onSelect(area)}
        title="View details"
      >
        <ColorDot color={area.colorHex} variant="circle" size="sm" />
        <span className="font-medium text-white truncate">
          {area.name}
        </span>
      </div>

      {/* Botões Rápidos (Abrem logo Editar ou Apagam) */}
      <div className="flex items-center gap-1 ml-2">
        <button
          onClick={() => onEdit(area)}
          className="text-neutral-500 hover:text-white transition-colors p-1.5"
          title="Edit Area"
        >
          <PencilIcon />
        </button>
        <button
          onClick={() => onDelete(area.id)}
          className="text-neutral-500 hover:text-red-500 transition-colors p-1.5"
          title="Delete Area"
        >
          <TrashIcon />
        </button>
      </div>

    </div>
  );
}
