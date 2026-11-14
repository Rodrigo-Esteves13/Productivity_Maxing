import { describe, expect, it } from 'vitest';
import { formatChangeValue, isOpaqueField, type FormatDeps } from './taskHistory';

const deps: FormatDeps = {
  t: (key) => key,
  enumLabel: (value) => `enum:${value}`,
  formatDate: (iso) => `date:${iso.slice(0, 10)}`,
};

describe('formatChangeValue', () => {
  it('shows empty for cleared values', () => {
    expect(formatChangeValue('realGrade', null, deps)).toBe('taskHistory.empty');
  });
  it('formats dates, booleans and enums by field', () => {
    expect(formatChangeValue('date', '2026-11-20T00:00:00.000Z', deps)).toBe('date:2026-11-20');
    expect(formatChangeValue('isPinned', 'true', deps)).toBe('taskHistory.yes');
    expect(formatChangeValue('isBlocked', 'false', deps)).toBe('taskHistory.no');
    expect(formatChangeValue('progressStatus', 'COMPLETED', deps)).toBe('enum:COMPLETED');
  });
  it('passes plain values through', () => {
    expect(formatChangeValue('title', 'New title', deps)).toBe('New title');
  });
  it('marks opaque id fields', () => {
    expect(isOpaqueField('areaId')).toBe(true);
    expect(isOpaqueField('title')).toBe(false);
  });
});
