import { describe, expect, it } from 'vitest';
import { buildTaskImportTemplateCsv } from './taskImportTemplate';

describe('buildTaskImportTemplateCsv', () => {
  it('starts with BOM and the required headers', () => {
    const csv = buildTaskImportTemplateCsv();
    expect(csv.startsWith('﻿')).toBe(true);
    const header = csv.split('\r\n')[0];
    expect(header).toContain('Title');
    expect(header).toContain('Date');
    expect(header).toContain('Area');
  });
  it('has header + one example row', () => {
    expect(buildTaskImportTemplateCsv().trim().split('\r\n')).toHaveLength(2);
  });
});
