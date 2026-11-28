import type { Area } from '../types/models';

// As cadeiras visiveis separadas por seccao, com os totais antes do filtro.
export function splitAreaSections(all: Area[], visible: Area[]) {
  const officialTotal = all.filter((a) => a.isOfficial).length;
  return {
    official: visible.filter((a) => a.isOfficial),
    personal: visible.filter((a) => !a.isOfficial),
    officialTotal,
    personalTotal: all.length - officialTotal,
  };
}

// Estado dos botoes "todas" / "nenhuma" sobre um conjunto de ids.
export function selectionState(ids: string[], selected: ReadonlySet<string>) {
  return {
    allSelected: ids.every((id) => selected.has(id)),
    anySelected: ids.some((id) => selected.has(id)),
  };
}
