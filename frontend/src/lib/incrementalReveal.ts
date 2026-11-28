// Minimo de linhas visiveis para a linha `index` aparecer numa lista revelada
// por blocos: arredonda ao bloco inteiro. 0 sem linha escolhida.
export function minVisibleForIndex(index: number, pageSize: number): number {
  return index < 0 ? 0 : Math.ceil((index + 1) / pageSize) * pageSize;
}
