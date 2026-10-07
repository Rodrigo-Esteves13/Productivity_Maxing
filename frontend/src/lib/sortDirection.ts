export type SortDirection = 'asc' | 'desc';

export const DEFAULT_SORT_DIRECTION: SortDirection = 'asc';

export function isSortDirection(value: unknown): value is SortDirection {
  return value === 'asc' || value === 'desc';
}

export function flipDirection(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc';
}
