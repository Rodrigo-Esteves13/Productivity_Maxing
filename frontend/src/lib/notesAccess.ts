import type { IncomingGrantsView } from '../api/socialNotesService';

/**
 * Cadeiras de um acesso que ainda aparecem como opcao no seletor. Uma
 * cadeira cujas notas ficaram todas privadas (ou apagadas) sai da lista; se
 * ficasse marcada sem se ver, nao dava para a desmarcar e o backend recusava.
 */
export function selectableGrantAreaIds(areaIds: string[], view: Pick<IncomingGrantsView, 'areas'>): string[] {
  const offered = new Set(view.areas.map((a) => a.areaId));
  return areaIds.filter((id) => offered.has(id));
}
