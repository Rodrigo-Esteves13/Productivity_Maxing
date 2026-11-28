import { describe, expect, it } from 'vitest';
import { addVisitedTab } from './visitedTabs';

describe('addVisitedTab', () => {
  it('appends a tab seen for the first time', () => {
    expect(addVisitedTab(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('returns the same list for a tab already visited', () => {
    const visited = ['a', 'b'];
    expect(addVisitedTab(visited, 'a')).toBe(visited);
  });
});
