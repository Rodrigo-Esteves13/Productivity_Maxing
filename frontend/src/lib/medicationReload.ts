// F-02: que partes do cartao da medicacao e preciso voltar a buscar depois de
// cada gravacao (antes eram sempre os 4 pedidos).

export type MedicationPart = 'medications' | 'day' | 'intakes' | 'disclaimer';

export const ALL_MEDICATION_PARTS: readonly MedicationPart[] = ['medications', 'day', 'intakes', 'disclaimer'];
// O que muda com o dia mostrado: tudo menos o aviso legal.
export const MEDICATION_DATA_PARTS: readonly MedicationPart[] = ['medications', 'day', 'intakes'];

export const MEDICATION_RELOAD = {
  // Um medicamento novo ainda nao tem tomas "se necessario".
  add: ['medications', 'day'],
  update: ['medications', 'day'],
  // As tomas mostram o nome do medicamento.
  rename: ['medications', 'day', 'intakes'],
  remove: ['medications', 'day', 'intakes'],
  intake: ['intakes'],
  disclaimer: ['disclaimer'],
} as const satisfies Record<string, readonly MedicationPart[]>;

/** Junta as partes pedidas as que ficaram por atualizar, sem repetidos. */
export function mergeParts(
  parts: readonly MedicationPart[],
  stale: readonly MedicationPart[],
): MedicationPart[] {
  return ALL_MEDICATION_PARTS.filter((part) => parts.includes(part) || stale.includes(part));
}
