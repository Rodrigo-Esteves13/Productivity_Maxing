// Geradores de calculo (codigo da app, nunca texto de IA). O quiz so guarda
// QUAIS tipos estao ligados; a lista e fechada e igual no cliente.
export const GENERATOR_KINDS = [
  'wildcard',
  'networkCmd',
  'networkMatch',
  'ospfCost',
  'spfPath',
  'routerId',
  'drBdr',
  'longestMatch',
  'subnetInfo',
  'usableHosts',
  'summarize',
  'binaryDecimal',
] as const;

export type GeneratorKind = (typeof GENERATOR_KINDS)[number];

export const isGeneratorKind = (v: unknown): v is GeneratorKind =>
  typeof v === 'string' && (GENERATOR_KINDS as readonly string[]).includes(v);

// Chave de estatistica agregada por tipo: gen-<kind>.
export const GENERATOR_STAT_PREFIX = 'gen-';
export const genStatKey = (kind: GeneratorKind): string =>
  `${GENERATOR_STAT_PREFIX}${kind}`;

// Tipos conhecidos, sem repetidos, na ordem do enum; ignora lixo da BD.
export function normalizeGenerators(raw: unknown): GeneratorKind[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set<unknown>(raw);
  return GENERATOR_KINDS.filter((kind) => wanted.has(kind));
}
