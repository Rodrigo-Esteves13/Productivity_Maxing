import { useState, type DragEvent, type KeyboardEvent } from 'react';
import AreaCard from './AreaCard';
import type { Area } from '../../types/models';
import { useI18n } from '../../i18n/useI18n';

interface AreaGridProps {
  areas: Area[];
  canManage: (area: Area) => boolean;
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
  onToggleHidden?: (area: Area) => void;
  // Sem isto a grelha nao se reordena. Arrastar um cartao para cima de
  // outro, ou Alt + seta esquerda/direita com o cartao focado.
  onReorder?: (draggedId: string, targetId: string) => void;
}

// Alt + seta: troca com o vizinho (teclado, sem rato).
const KEY_STEP: Record<string, number> = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 };

export default function AreaGrid({ areas, canManage, onSelect, onEdit, onDelete, onToggleHidden, onReorder }: AreaGridProps) {
  const { t } = useI18n();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleDragStart = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    setDraggedId(id);
    // Firefox so comeca a arrastar com setData.
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (id !== dragOverId) setDragOverId(id);
  };
  const handleDrop = (id: string) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (draggedId && onReorder) onReorder(draggedId, id);
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };
  const handleKeyDown = (index: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEP[e.key];
    if (!e.altKey || step === undefined || !onReorder || e.target !== e.currentTarget) return;
    const neighbour = areas[index + step];
    if (!neighbour) return;
    e.preventDefault();
    onReorder(areas[index].id, neighbour.id);
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {areas.map((area, index) => {
        const card = (
          <AreaCard
            area={area}
            canManage={canManage(area)}
            onSelect={onSelect}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleHidden={onToggleHidden}
          />
        );
        if (!onReorder) return <div key={area.id}>{card}</div>;
        return (
          <div
            key={area.id}
            draggable
            tabIndex={0}
            aria-label={t('areaOrder.cardLabel', { name: area.name })}
            onDragStart={handleDragStart(area.id)}
            onDragOver={handleDragOver(area.id)}
            onDrop={handleDrop(area.id)}
            onDragEnd={handleDragEnd}
            onKeyDown={handleKeyDown(index)}
            className={`rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
              draggedId === area.id ? 'opacity-50' : ''
            } ${dragOverId === area.id && draggedId !== area.id ? 'ring-2 ring-violet-500' : ''}`}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
}
