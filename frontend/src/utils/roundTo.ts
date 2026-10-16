// Arredonda para N casas decimais (por omissao 1). Um so sitio para isto,
// em vez de `Math.round(n * 10) / 10` repetido pelos ficheiros.
const DEFAULT_DECIMALS = 1;

export function roundTo(value: number, decimals: number = DEFAULT_DECIMALS): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
