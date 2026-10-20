// Prioridades, tipos de task e subtipos academicos vem de catalogos geridos
// pelo admin (/task-types), com o rotulo guardado em ingles. Os que os seeds
// criam (backend/prisma/scripts/seed-priorities.ts e seed-task-types.ts) sao
// traduzidos enquanto o admin nao lhes mudar o nome; um item novo ou
// renomeado mostra exatamente o texto que o admin escreveu.
const SEEDED_LABELS = {
  priority: {
    LOW: 'Low',
    MEDIUM: 'Medium',
    HIGH: 'High',
  },
  taskType: {
    ACADEMICO: 'Academic',
    HABITO: 'Habit',
    PROJETO: 'Project',
    EVENTO: 'Event',
    TRABALHO: 'Job',
    TAREFA_SIMPLES: 'Simple Task',
    OTHER: 'Other',
  },
  academicType: {
    FREQUENCIA: 'Test',
    TRABALHO_PRATICO: 'Practical Assignment',
    TAREFA_SECUNDARIA: 'Secondary Task',
  },
} satisfies Record<string, Record<string, string>>;

export type CatalogKind = keyof typeof SEEDED_LABELS;

/** Chave i18n do item se for um dos semeados e com o nome original; senao null. */
export function seededCatalogKey(
  kind: CatalogKind,
  key: string,
  label: string | null | undefined,
): string | null {
  const seeded: Record<string, string> = SEEDED_LABELS[kind];
  if (!Object.hasOwn(seeded, key)) return null;
  return !label || label === seeded[key] ? `${kind}.${key}` : null;
}
