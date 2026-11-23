import { STORAGE_KEYS } from './storageKeys';

// Alvo de media da calculadora "o que preciso", guardado por Area (ou pelo
// periodo todo) so neste browser. Mapa { chave: texto do campo }.
export type GradeTargets = Record<string, string>;

export function parseGradeTargets(raw: string | null): GradeTargets {
  if (!raw) return {};
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}

// Valor vazio apaga a entrada, para o mapa nao crescer com chaves mortas.
export function withGradeTarget(targets: GradeTargets, key: string, value: string): GradeTargets {
  const { [key]: _dropped, ...rest } = targets;
  void _dropped;
  return value === '' ? rest : { ...rest, [key]: value };
}

export function loadGradeTargets(): GradeTargets {
  try {
    return parseGradeTargets(localStorage.getItem(STORAGE_KEYS.gradeTargets));
  } catch {
    return {};
  }
}

export function saveGradeTargets(targets: GradeTargets): void {
  try {
    localStorage.setItem(STORAGE_KEYS.gradeTargets, JSON.stringify(targets));
  } catch {
    // Sem armazenamento (modo privado): o alvo so dura nesta visita.
  }
}
