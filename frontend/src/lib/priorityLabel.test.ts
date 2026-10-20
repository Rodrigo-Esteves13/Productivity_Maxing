import { describe, expect, it } from 'vitest';
import { seededPriorityKey } from './priorityLabel';

describe('seededPriorityKey', () => {
  it('translates the seeded priorities while they keep their original name', () => {
    expect(seededPriorityKey('MEDIUM', 'Medium')).toBe('priority.MEDIUM');
    expect(seededPriorityKey('LOW', null)).toBe('priority.LOW');
  });

  it('keeps what the admin wrote for renamed or new priorities', () => {
    expect(seededPriorityKey('HIGH', 'Urgent')).toBeNull();
    expect(seededPriorityKey('CRITICAL', 'Critical')).toBeNull();
    expect(seededPriorityKey('toString', null)).toBeNull();
  });
});
