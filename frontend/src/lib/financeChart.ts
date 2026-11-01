// Cores dos graficos de Money. Variaveis do tema (as mesmas dos utilitarios
// Tailwind), por isso acompanham os temas e o modo de alto contraste.
// Sem verde. Rendimento e despesa mantem as cores do resto da pagina.
export const INCOME_COLOR = 'var(--color-cyan-400)';
export const EXPENSE_COLOR = 'var(--color-red-400)';
export const GRID_COLOR = 'var(--color-neutral-800)';
export const AXIS_COLOR = 'var(--color-neutral-500)';
export const PROJECTED_OPACITY = 0.4;
export const SOLID_OPACITY = 1;

export interface CategorySwatch {
  /** Para recharts (fill). */
  color: string;
  /** Para a bolinha da legenda (classe literal para o Tailwind a ver). */
  dotClass: string;
}

// Ordem fixa: a categoria com mais gasto fica com o primeiro. O que passar
// do limite junta-se em "Outras" (cinzento).
export const CATEGORY_SWATCHES: CategorySwatch[] = [
  { color: 'var(--color-violet-400)', dotClass: 'bg-violet-400' },
  { color: 'var(--color-amber-400)', dotClass: 'bg-amber-400' },
  { color: 'var(--color-cyan-400)', dotClass: 'bg-cyan-400' },
  { color: 'var(--color-pink-400)', dotClass: 'bg-pink-400' },
  { color: 'var(--color-indigo-300)', dotClass: 'bg-indigo-300' },
  { color: 'var(--color-orange-500)', dotClass: 'bg-orange-500' },
];
export const OTHER_SWATCH: CategorySwatch = { color: 'var(--color-neutral-500)', dotClass: 'bg-neutral-500' };
export const OTHER_KEY = 'OTHER_GROUP';

export interface CategorySlice {
  key: string;
  cents: number;
  swatch: CategorySwatch;
}

/** Soma o gasto por categoria de todos os baldes e agrupa a cauda em "Outras". */
export function buildCategorySlices(series: { expensesByCategory: Record<string, number> }[]): CategorySlice[] {
  const totals = new Map<string, number>();
  for (const bucket of series) {
    for (const [category, cents] of Object.entries(bucket.expensesByCategory)) {
      totals.set(category, (totals.get(category) ?? 0) + cents);
    }
  }
  const sorted = [...totals.entries()].filter(([, cents]) => cents > 0).sort((a, b) => b[1] - a[1]);
  const head = sorted.slice(0, CATEGORY_SWATCHES.length).map(([key, cents], i) => ({ key, cents, swatch: CATEGORY_SWATCHES[i] }));
  const tail = sorted.slice(CATEGORY_SWATCHES.length).reduce((sum, [, cents]) => sum + cents, 0);
  return tail > 0 ? [...head, { key: OTHER_KEY, cents: tail, swatch: OTHER_SWATCH }] : head;
}
