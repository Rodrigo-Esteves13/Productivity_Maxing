// Escala de notas guardada como "min-max" (ex: "0-20"). Sem um maximo valido
// assume-se a escala portuguesa.
export const DEFAULT_SCALE_MAX = 20;

export function scaleMax(scale: string): number {
  const max = Number(scale.split('-')[1]);
  return Number.isFinite(max) && max > 0 ? max : DEFAULT_SCALE_MAX;
}
