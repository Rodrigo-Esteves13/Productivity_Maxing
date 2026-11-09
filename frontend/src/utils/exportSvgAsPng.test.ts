import { describe, expect, it } from 'vitest';
import {
  EXPORT_SCALE,
  FALLBACK_SLUG,
  MAX_CANVAS_SIDE_PX,
  MAX_SLUG_LENGTH,
  buildExportFilename,
  clampExportScale,
  computeCanvasSize,
  isTransparentColor,
  slugifyFilename,
} from './exportSvgAsPng';

describe('slugifyFilename', () => {
  it('lowercases, strips accents and unsafe characters', () => {
    expect(slugifyFilename('Média / Período: 2024?')).toBe('media-periodo-2024');
  });
  it('falls back when nothing usable remains', () => {
    expect(slugifyFilename('???')).toBe(FALLBACK_SLUG);
    expect(slugifyFilename('')).toBe(FALLBACK_SLUG);
  });
  it('blocks path traversal', () => {
    expect(slugifyFilename('../../etc/passwd')).toBe('etc-passwd');
  });
  it('caps length without trailing dash', () => {
    const slug = slugifyFilename(`${'a'.repeat(MAX_SLUG_LENGTH - 1)} b`);
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('buildExportFilename', () => {
  it('appends the local date and png extension', () => {
    expect(buildExportFilename('GPA Trend', new Date(2026, 0, 5))).toBe('gpa-trend-2026-01-05.png');
  });
});

describe('clampExportScale', () => {
  it('keeps the desired scale for normal sizes', () => {
    expect(clampExportScale(800, 300)).toBe(EXPORT_SCALE);
  });
  it('reduces the scale for huge sizes', () => {
    const scale = clampExportScale(MAX_CANVAS_SIDE_PX, 100);
    expect(scale).toBe(1);
    expect(clampExportScale(MAX_CANVAS_SIDE_PX * 4, 10)).toBe(0.25);
  });
  it('ignores invalid sizes', () => {
    expect(clampExportScale(0, 0)).toBe(EXPORT_SCALE);
    expect(clampExportScale(NaN, 10)).toBe(EXPORT_SCALE);
  });
});

describe('computeCanvasSize', () => {
  it('scales and rounds', () => {
    expect(computeCanvasSize(100.4, 50, 2)).toEqual({ width: 201, height: 100 });
  });
  it('clamps to min and max', () => {
    expect(computeCanvasSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
    expect(computeCanvasSize(MAX_CANVAS_SIDE_PX * 2, 10, 1).width).toBe(MAX_CANVAS_SIDE_PX);
  });
});

describe('isTransparentColor', () => {
  it('detects transparent forms', () => {
    expect(isTransparentColor('transparent')).toBe(true);
    expect(isTransparentColor('rgba(0, 0, 0, 0)')).toBe(true);
    expect(isTransparentColor('rgb(0 0 0 / 0)')).toBe(true);
    expect(isTransparentColor('rgb(10, 10, 0)')).toBe(false);
    expect(isTransparentColor('')).toBe(true);
  });
  it('accepts opaque colors', () => {
    expect(isTransparentColor('rgb(10, 10, 10)')).toBe(false);
    expect(isTransparentColor('rgba(10, 10, 10, 0.5)')).toBe(false);
  });
});
