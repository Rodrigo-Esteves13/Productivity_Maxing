import { describe, expect, it } from 'vitest';
import { collectTags, normalizeTag, TAG_LEN_MAX } from './taskTags';
import type { Task } from '../types/models';

describe('taskTags', () => {
  it('normalizes a tag', () => {
    expect(normalizeTag('  Exam   Prep ')).toBe('exam prep');
    expect(normalizeTag('x'.repeat(40))).toHaveLength(TAG_LEN_MAX);
  });
  it('collects distinct sorted tags and tolerates missing tags', () => {
    const tasks = [{ tags: ['b', 'a'] }, { tags: ['a'] }, {}] as unknown as Task[];
    expect(collectTags(tasks)).toEqual(['a', 'b']);
  });
});
