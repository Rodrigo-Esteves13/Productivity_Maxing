import { useMemo } from 'react';
import type { Area } from '../types/models';

// Mapa id -> Area, recalculado so quando a lista muda. Seis cartoes do
// Dashboard construiam o seu proprio Map em cada render.
export function useAreaLookup(areas: Area[]): Map<string, Area> {
  return useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
}
