// Exports an on-screen SVG chart as a PNG using only browser APIs (no
// html2canvas): clone the SVG, inline the computed styles (so CSS variables,
// currentColor and Tailwind classes resolve to concrete values), serialize it,
// draw it on a canvas at 2x with an opaque background and download the blob.

export const EXPORT_SCALE = 2;
// Browsers refuse canvases past roughly this side length; clamp below it.
export const MAX_CANVAS_SIDE_PX = 8192;
export const MIN_CANVAS_SIDE_PX = 1;
export const EXPORT_FILE_EXTENSION = 'png';
export const EXPORT_MIME_TYPE = 'image/png';
export const FALLBACK_SLUG = 'chart';
export const MAX_SLUG_LENGTH = 60;
// Used only when no ancestor has an opaque background (dark app theme).
export const FALLBACK_BACKGROUND = '#0a0a0a';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SVG_DATA_URL_PREFIX = 'data:image/svg+xml;charset=utf-8,';
const TRANSPARENT_COLORS = ['transparent', 'rgba(0, 0, 0, 0)', 'rgba(0,0,0,0)'];
const ALPHA_ZERO_PATTERN = /^(rgba|hsla)\(.*,\s*0(\.0+)?\s*\)$|^\w+\(.*\/\s*0(\.0+)?%?\s*\)$/i;

// Presentation properties copied from computed style onto each cloned node.
const INLINED_PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'color',
  'stop-color',
  'stop-opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
  'dominant-baseline',
  'visibility',
  'display',
] as const;

/** Lowercase ascii slug, safe as a filename segment. */
export function slugifyFilename(raw: string): string {
  const slug = raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
  return slug || FALLBACK_SLUG;
}

/** "<slug>-YYYY-MM-DD.png" for the given date (local time). */
export function buildExportFilename(slug: string, date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${slugifyFilename(slug)}-${day}.${EXPORT_FILE_EXTENSION}`;
}

/** Scale to use so neither canvas side passes the browser limit. */
export function clampExportScale(width: number, height: number, desired: number = EXPORT_SCALE): number {
  const longest = Math.max(width, height);
  if (!Number.isFinite(longest) || longest <= 0) return desired;
  return Math.min(desired, MAX_CANVAS_SIDE_PX / longest);
}

/** Canvas size in whole pixels, never below the minimum side. */
export function computeCanvasSize(width: number, height: number, scale: number): { width: number; height: number } {
  const side = (v: number) => Math.min(MAX_CANVAS_SIDE_PX, Math.max(MIN_CANVAS_SIDE_PX, Math.round(v * scale)));
  return { width: side(width), height: side(height) };
}

export function isTransparentColor(color: string): boolean {
  const value = color.trim().toLowerCase();
  return value === '' || TRANSPARENT_COLORS.includes(value) || ALPHA_ZERO_PATTERN.test(value);
}

// First opaque background walking up from the chart, else body/html, else fallback.
function resolveBackground(el: Element): string {
  for (let node: Element | null = el; node; node = node.parentElement) {
    const bg = getComputedStyle(node).backgroundColor;
    if (!isTransparentColor(bg)) return bg;
  }
  return FALLBACK_BACKGROUND;
}

function inlineComputedStyles(source: Element, target: Element) {
  const computed = getComputedStyle(source);
  const style = (target as SVGElement).style;
  if (style) {
    for (const prop of INLINED_PROPERTIES) {
      const value = computed.getPropertyValue(prop);
      if (value) style.setProperty(prop, value);
    }
  }
  // Drop classes: their rules do not exist inside the serialized image.
  target.removeAttribute('class');
  const sourceChildren = source.children;
  const targetChildren = target.children;
  for (let i = 0; i < sourceChildren.length; i++) {
    inlineComputedStyles(sourceChildren[i], targetChildren[i]);
  }
}

function measure(svg: SVGSVGElement): { width: number; height: number } {
  const rect = svg.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('SVG image failed to load'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas export failed'))), EXPORT_MIME_TYPE);
  });
}

/** Renders the SVG to a PNG blob at 2x (clamped), on an opaque background. */
export async function renderSvgToPngBlob(svg: SVGSVGElement): Promise<Blob> {
  const { width, height } = measure(svg);
  if (width <= 0 || height <= 0) throw new Error('Chart has no size');

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute('xmlns', SVG_NS);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const scale = clampExportScale(width, height);
  const size = computeCanvasSize(width, height, scale);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  ctx.fillStyle = resolveBackground(svg);
  ctx.fillRect(0, 0, size.width, size.height);
  const image = await loadImage(SVG_DATA_URL_PREFIX + encodeURIComponent(new XMLSerializer().serializeToString(clone)));
  ctx.drawImage(image, 0, 0, size.width, size.height);
  return canvasToBlob(canvas);
}

/** Exports the SVG as a downloaded "<slug>-YYYY-MM-DD.png". */
export async function exportSvgAsPng(svg: SVGSVGElement, slug: string, date: Date = new Date()): Promise<void> {
  const blob = await renderSvgToPngBlob(svg);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = buildExportFilename(slug, date);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
