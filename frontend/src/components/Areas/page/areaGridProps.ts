import type { ComponentProps } from 'react';
import type AreaGrid from '../AreaGrid';
import type { AreasViewState } from '../../../hooks/useAreasView';

// Props comuns as grelhas das duas seccoes.
export function areaGridProps(view: AreasViewState): Omit<ComponentProps<typeof AreaGrid>, 'areas' | 'onToggleHidden'> {
  return {
    canManage: view.canManage,
    onSelect: view.openDetailModal,
    onEdit: view.startEditing,
    onDelete: view.handleDeleteArea,
    onReorder: view.canReorder ? view.reorder : undefined,
    selectMode: view.selectMode,
    selectedIds: view.selectedSet,
    onToggleSelect: (area) => view.toggleSelected(area.id),
  };
}
