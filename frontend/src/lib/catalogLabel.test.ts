import { describe, expect, it } from 'vitest';
import { seededCatalogKey } from './catalogLabel';

describe('seededCatalogKey', () => {
  it('translates the seeded items while they keep their original name', () => {
    expect(seededCatalogKey('priority', 'MEDIUM', 'Medium')).toBe('priority.MEDIUM');
    expect(seededCatalogKey('priority', 'LOW', null)).toBe('priority.LOW');
    expect(seededCatalogKey('taskType', 'TAREFA_SIMPLES', 'Simple Task')).toBe('taskType.TAREFA_SIMPLES');
    expect(seededCatalogKey('academicType', 'FREQUENCIA', undefined)).toBe('academicType.FREQUENCIA');
  });

  it('keeps what the admin wrote for renamed or new items', () => {
    expect(seededCatalogKey('priority', 'HIGH', 'Urgent')).toBeNull();
    expect(seededCatalogKey('priority', 'CRITICAL', 'Critical')).toBeNull();
    expect(seededCatalogKey('priority', 'toString', null)).toBeNull();
    expect(seededCatalogKey('taskType', 'PROJETO', 'Side project')).toBeNull();
    expect(seededCatalogKey('academicType', 'EXAME', 'Exam')).toBeNull();
  });

  it('does not mix catalogs that share a key', () => {
    expect(seededCatalogKey('academicType', 'OTHER', 'Other')).toBeNull();
  });
});
