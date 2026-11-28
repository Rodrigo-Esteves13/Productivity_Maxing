// Cores dos graficos e SVG: apontam para os tokens do tema (@theme em
// index.css), por isso mudam com o tema e o acento. O export para PNG resolve
// as variaveis (utils/exportSvgAsPng).
export const CHART_COLORS = {
  accent: 'var(--color-violet-400)',
  accentLight: 'var(--color-violet-300)',
  accentStrong: 'var(--color-violet-500)',
  surface: 'var(--color-neutral-900)',
  grid: 'var(--color-neutral-800)',
  axis: 'var(--color-neutral-700)',
  fallback: 'var(--color-neutral-600)',
  muted: 'var(--color-neutral-500)',
  label: 'var(--color-neutral-400)',
  threshold: 'var(--color-amber-400)',
} as const;
