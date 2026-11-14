// Sugestao de redistribuir carga: dentro dos proximos dias, o dia com menos
// tasks por fazer que o dia escolhido. Puro e sem rede.
export const LIGHTER_DAY_SPAN = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function addDays(key: string, days: number): string {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Dia dos proximos LIGHTER_DAY_SPAN dias (a seguir a `date`) com estritamente
 * menos tasks que `date`; empate resolve-se pelo mais cedo. null se nenhum
 * for mais leve.
 */
export function suggestLighterDay(date: string, countsByDay: ReadonlyMap<string, number>): string | null {
  const current = countsByDay.get(date) ?? 0;
  let best: { key: string; count: number } | null = null;
  for (let offset = 1; offset <= LIGHTER_DAY_SPAN; offset++) {
    const key = addDays(date, offset);
    const count = countsByDay.get(key) ?? 0;
    if (count < current && (best === null || count < best.count)) best = { key, count };
  }
  return best?.key ?? null;
}
